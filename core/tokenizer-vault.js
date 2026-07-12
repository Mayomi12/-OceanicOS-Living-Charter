/*
 * Ω∞ OceanicOS :: Tokenizer Vault  (Living Tokenization Studio × the Memory Ocean)
 * Build 0029 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * Where the Tokenization Studio meets the Constitution. Until now a trained
 * tokenizer was a value held in a variable — it vanished when the page closed and
 * left no record. A trained model is knowledge; the Charter says knowledge lives
 * in the Memory Ocean, with provenance, and its history is never silently erased.
 *
 * This capability composes the Tokenization SDK (0028) with Memory (0005):
 *   - train(name, corpus, {kind, vocabSize, source})  trains a tokenizer AND
 *     records the model in Memory with full provenance (kind, vocabSize, merges,
 *     corpus size + checksum, source, timestamp).
 *   - load(name)   rebuilds a ready tokenizer from the current stored model.
 *   - revise(name, corpus, …)  retrains and records it as an OPEN amendment
 *     (Memory.amend): the previous model is superseded, never deleted.
 *   - list()       the current vaulted tokenizers, with provenance.
 *   - history(name) the full lineage — every version, including superseded ones.
 *
 * Because it writes through Memory, every Charter memory-invariant holds for free:
 * append-only (there is no delete), corrections supersede openly, provenance on
 * every record. The Vault adds no way to erase a model — only to supersede it.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./memory.js"), require("./tokenization-sdk.js").createTokenization || require("./tokenization-sdk.js"));
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createTokenizerVault = factory(root.OceanicCore && root.OceanicCore.createMemory, root.OceanicCore && root.OceanicCore.createTokenization);
})(typeof self !== "undefined" ? self : this, function (createMemory, createTokenization) {
  "use strict";

  if (typeof createMemory !== "function") throw new Error("createTokenizerVault is composed on Memory (build 0005) — load core/memory.js first");
  if (typeof createTokenization !== "function") throw new Error("createTokenizerVault is composed on the Tokenization SDK (build 0028) — load core/tokenization-sdk.js first");

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
    }
    return obj;
  }
  // small, stable checksum for provenance (djb2 over UTF-16 code units)
  function checksum(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  var TYPE = "tokenizer-model";

  function createTokenizerVault(options) {
    options = options || {};
    var memory = options.memory || createMemory({ name: options.name || "tokenizers", now: options.now, storage: options.storage, storageKey: options.storageKey });
    var T = options.tokenization || createTokenization();
    var current = {}; // name -> current memory record id (rebuilt from memory on load)

    // rebuild the name -> current-record index from whatever is already in memory
    function reindex() {
      current = {};
      memory.recall({ type: TYPE }).forEach(function (r) { if (r.meta && r.meta.name) current[r.meta.name] = r.id; });
    }
    reindex();

    function buildModel(kind, corpus, vocabSize, opts) {
      var tk = T.create(kind);
      var report = tk.train(corpus, vocabSize, opts && opts.trainOptions);
      return { tk: tk, model: tk.exportModel(), report: report };
    }

    function provenanceEntry(name, kind, corpus, built, source) {
      return {
        type: TYPE,
        body: 'tokenizer "' + name + '" (' + kind + ", vocab " + built.report.achievedVocabSize + ")",
        source: source || null,
        confidence: "certain",
        meta: {
          name: name, kind: kind, model: built.model,
          vocabSize: built.report.achievedVocabSize, merges: built.report.mergesPerformed,
          corpusBytes: built.report.inputBytes, corpusChecksum: checksum(String(corpus == null ? "" : corpus))
        }
      };
    }

    function shapeRecord(r) {
      return {
        name: r.meta.name, kind: r.meta.kind, vocabSize: r.meta.vocabSize, merges: r.meta.merges,
        corpusBytes: r.meta.corpusBytes, corpusChecksum: r.meta.corpusChecksum,
        source: r.source, at: r.at, recordId: r.id, supersedes: r.supersedes || null
      };
    }

    function train(name, corpus, opts) {
      opts = opts || {};
      if (!name || typeof name !== "string") throw new TypeError("train requires a tokenizer name (string)");
      var kind = opts.kind || "regex";
      var vocabSize = opts.vocabSize || 512;
      if (current[name]) throw new Error('a tokenizer named "' + name + '" already exists — use revise() to supersede it openly');
      var built = buildModel(kind, corpus, vocabSize, opts);
      var rec = memory.remember(provenanceEntry(name, kind, corpus, built, opts.source));
      current[name] = rec.id;
      return deepFreeze(shapeRecord(rec));
    }

    function revise(name, corpus, opts) {
      opts = opts || {};
      var id = current[name];
      if (!id) throw new Error('no tokenizer named "' + name + '" to revise — use train() first');
      var prev = memory.get(id);
      var kind = opts.kind || prev.meta.kind; // keep the kind unless explicitly changed
      var vocabSize = opts.vocabSize || prev.meta.vocabSize;
      var built = buildModel(kind, corpus, vocabSize, opts);
      var rec = memory.amend(id, provenanceEntry(name, kind, corpus, built, opts.source)); // open supersession — original kept
      current[name] = rec.id;
      return deepFreeze(shapeRecord(rec));
    }

    // rebuild a ready-to-use tokenizer from the current stored model
    function load(name) {
      var id = current[name];
      if (!id) return null;
      var r = memory.get(id);
      var tk = T.create(r.meta.kind);
      tk.loadModel(r.meta.model);
      return tk;
    }

    function describe(name) {
      var id = current[name];
      return id ? deepFreeze(shapeRecord(memory.get(id))) : null;
    }

    function list() {
      return deepFreeze(Object.keys(current).map(function (name) { return shapeRecord(memory.get(current[name])); }));
    }

    // full lineage of a name — every version, superseded ones included (nothing erased)
    function history(name) {
      return deepFreeze(memory.recall({ type: TYPE, includeSuperseded: true })
        .filter(function (r) { return r.meta && r.meta.name === name; })
        .map(shapeRecord));
    }

    function status() {
      return deepFreeze({ tokenizers: Object.keys(current).length, records: memory.recall({ type: TYPE, includeSuperseded: true }).length });
    }

    // Note what is deliberately absent: no delete(), no forget(). A model can be
    // superseded (revise), never erased — the Charter, enforced by composition.
    return {
      train: train, revise: revise, load: load, describe: describe,
      list: list, history: history, status: status,
      memory: memory, tokenization: T
    };
  }

  return createTokenizerVault;
});
