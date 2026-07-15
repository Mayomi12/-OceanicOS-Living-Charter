/*
 * Ω∞ OceanicOS :: Preservation
 * Build 0059 · Stage 8 (Stewardship) · zero-runtime (plain browser or any JS engine)
 *
 * The Charter's long horizon: knowledge preserved FOR FUTURE GENERATIONS.
 * Preservation is what makes an ocean survivable across years, machines and
 * hands — and what makes silent corruption LOUD:
 *
 *   seal(source, { label })  → a self-describing ARCHIVE envelope: the whole
 *       snapshot plus its FIXITY (algorithm, digest, byte length, record
 *       count, sealed-at) — everything a future steward needs to trust it
 *   verify(archive)          → recompute the fixity and compare; any flipped
 *       character anywhere is detected and reported
 *   inventory(archive)       → peek at what an archive holds WITHOUT opening it
 *   restore(archive)         → verify FIRST, then hydrate a working Memory —
 *       a corrupt archive is REFUSED, never silently half-restored
 *   audit(archives)          → re-verify a whole shelf at once (the periodic
 *       fixity check every real archive practice requires)
 *
 * THE HONEST LIMIT, stated as always: the digest (FNV-1a, 32-bit, with byte
 * length) is a FIXITY check — it makes accident, rot and transmission damage
 * detectable. It is NOT a cryptographic seal against a deliberate adversary,
 * and this module never claims otherwise. Pairs naturally with Migration
 * (0058, archival copies) and Store (0024, where the bytes live).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createPreservation = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var ALGORITHM = "fnv1a32+len"; // fixity, not cryptography — and we say so

  function fnv1a(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; // h * 16777619, in 32-bit
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  function createPreservation(options) {
    options = options || {};
    var C = (root && root.OceanicCore) || {};
    var memoryFactory = options.memoryFactory || C.createMemory;
    if (typeof memoryFactory !== "function") {
      throw new Error("createPreservation needs the Memory factory — load core/memory.js first, or pass { memoryFactory }");
    }
    var now = options.now || function () { return Date.now(); };

    function digest(text) {
      text = String(text);
      return ALGORITHM + ":" + fnv1a(text) + ":" + text.length;
    }

    function snapshotOf(source, verb) {
      if (source && typeof source.exportSnapshot === "function") return source.exportSnapshot();
      if (typeof source === "string") return source;
      if (source && Array.isArray(source.records)) return JSON.stringify({ v: 1, records: source.records });
      throw new TypeError(verb + " requires a Memory/OceanicOS, a snapshot string, or { records: [...] }");
    }

    function seal(source, opts) {
      opts = opts || {};
      var snapshot = snapshotOf(source, "seal");
      var records;
      try { records = JSON.parse(snapshot).records.length; }
      catch (e) { throw new TypeError("seal: the source snapshot is not valid JSON — refusing to seal damage"); }
      return JSON.stringify({
        oceanicArchive: 1,
        label: opts.label || "archive",
        sealedAt: now(),
        records: records,
        fixity: { algorithm: ALGORITHM, digest: digest(snapshot), note: "fixity against accident and rot — not a cryptographic seal against an adversary" },
        snapshot: snapshot
      });
    }

    function envelope(archive, verb) {
      if (typeof archive !== "string") throw new TypeError(verb + " requires a sealed archive string");
      var env;
      try { env = JSON.parse(archive); }
      catch (e) { throw new TypeError(verb + ": not a readable archive (bad JSON)"); }
      if (!env || env.oceanicArchive !== 1 || typeof env.snapshot !== "string" || !env.fixity) {
        throw new TypeError(verb + ": not an OceanicOS archive envelope");
      }
      return env;
    }

    function verify(archive) {
      var env = envelope(archive, "verify");
      var expected = env.fixity.digest;
      var actual = digest(env.snapshot);
      var intact = expected === actual;
      var records = null, hydrates = false;
      if (intact) {
        try { records = JSON.parse(env.snapshot).records.length; hydrates = records === env.records; }
        catch (e) { intact = false; }
      }
      return {
        intact: intact && hydrates,
        label: env.label, sealedAt: env.sealedAt,
        expected: expected, actual: actual,
        records: { declared: env.records, found: records },
        detail: intact && hydrates ? "fixity holds — every character is as it was sealed"
              : expected !== actual ? "FIXITY BROKEN — the archive's content no longer matches its seal"
              : "record count mismatch — the archive is internally inconsistent"
      };
    }

    function inventory(archive) {
      var env = envelope(archive, "inventory");
      return { label: env.label, sealedAt: env.sealedAt, records: env.records,
               fixity: { algorithm: env.fixity.algorithm, digest: env.fixity.digest },
               bytes: env.snapshot.length };
    }

    function restore(archive) {
      var v = verify(archive);
      if (!v.intact) {
        throw new Error("restore REFUSED — " + v.detail + " (label: " + v.label + "). A corrupt archive is a human decision, not a silent half-restore.");
      }
      var env = envelope(archive, "restore");
      var d = {};
      var storage = { getItem: function (k) { return (k in d) ? d[k] : null; }, setItem: function (k, v2) { d[k] = v2; } };
      storage.setItem("oceanicos.memory", env.snapshot);
      var memory = memoryFactory({ storage: storage });
      if (memory.status().count !== env.records) {
        throw new Error("restore REFUSED — hydrated " + memory.status().count + " of " + env.records + " records");
      }
      return { memory: memory, label: env.label, sealedAt: env.sealedAt, records: env.records };
    }

    function audit(archives) {
      if (!Array.isArray(archives)) throw new TypeError("audit requires an array of archives — the shelf");
      var results = archives.map(function (a, i) {
        try { var v = verify(a); return { index: i, label: v.label, intact: v.intact, detail: v.detail }; }
        catch (e) { return { index: i, label: null, intact: false, detail: String(e && e.message ? e.message : e) }; }
      });
      var broken = results.filter(function (r) { return !r.intact; });
      return { archives: results.length, intact: results.length - broken.length, broken: broken.length,
               results: results,
               headline: broken.length === 0
                 ? "ALL " + results.length + " ARCHIVES INTACT"
                 : broken.length + " of " + results.length + " archives DAMAGED — " + broken.map(function (b) { return b.label || ("#" + (b.index + 1)); }).join(", ") };
    }

    return { digest: digest, seal: seal, verify: verify, inventory: inventory, restore: restore, audit: audit };
  }

  createPreservation.ALGORITHM = ALGORITHM;
  return createPreservation;
});
