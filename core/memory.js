/*
 * Ω∞ OceanicOS Core :: Memory
 * Build 0005 · Stage 1 · zero-runtime (plain browser or any JS engine)
 *
 * The Core's Memory Ocean: an append-only store of records with provenance.
 *
 * Constitutional invariants, enforced in code:
 *  - APPEND-ONLY: there is no delete. History is never erased.
 *  - CORRECTIONS ARE OPEN: amend() never rewrites a record — it appends a new
 *    one that declares `supersedes: <old id>`. The old record remains, visible
 *    on demand, so the story of how understanding changed is itself remembered.
 *  - PROVENANCE: every record carries source, confidence, and a timestamp.
 *  - IMMUTABILITY: returned records are deep-frozen.
 *
 * Design constraints (house style of core/heartbeat.js and core/verify-engine.js):
 *  - No dependencies. Injectable clock and id generator for determinism.
 *  - Optional storage adapter (localStorage-compatible: getItem/setItem) for
 *    persistence; storage failures never lose the in-memory record.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createMemory = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CONFIDENCE = ["certain", "high", "medium", "low", "speculation"];

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
    }
    return obj;
  }

  function createMemory(options) {
    options = options || {};
    var name = options.name || "memory";
    var now = options.now || function () { return Date.now(); };
    var seq = 0;
    var idgen = options.idgen || function () {
      seq += 1;
      return "m-" + seq + "-" + Math.random().toString(16).slice(2, 8);
    };
    var storage = options.storage || null;
    var storageKey = options.storageKey || ("oceanicos." + name);

    var records = [];          // append-only
    var byId = {};             // id -> record
    var supersededIds = {};    // old id -> superseding id
    var storageErrors = 0;

    /* ---- persistence (optional, failure-tolerant) ---- */
    function persist() {
      if (!storage) return;
      try { storage.setItem(storageKey, JSON.stringify({ v: 1, records: records })); }
      catch (e) { storageErrors += 1; } // storage may fail; memory must not
    }
    function hydrate() {
      if (!storage) return;
      try {
        var raw = storage.getItem(storageKey);
        if (!raw) return;
        var snap = JSON.parse(raw);
        if (!snap || !Array.isArray(snap.records)) return;
        for (var i = 0; i < snap.records.length; i++) {
          var r = deepFreeze(snap.records[i]);
          records.push(r);
          byId[r.id] = r;
          if (r.supersedes) supersededIds[r.supersedes] = r.id;
        }
      } catch (e) { storageErrors += 1; }
    }

    /* ---- core ---- */
    function makeRecord(entry, supersedes) {
      if (!entry || typeof entry.body !== "string" || !entry.body) {
        throw new TypeError("remember requires an entry with a non-empty string body");
      }
      var confidence = entry.confidence || "medium";
      if (CONFIDENCE.indexOf(confidence) < 0) {
        throw new TypeError("confidence must be one of: " + CONFIDENCE.join(", "));
      }
      return deepFreeze({
        id: idgen(),
        at: now(),
        type: entry.type || "observation",
        body: entry.body,
        source: entry.source || null,
        confidence: confidence,
        meta: entry.meta || null,
        supersedes: supersedes || null
      });
    }

    function remember(entry) {
      var r = makeRecord(entry, null);
      records.push(r);
      byId[r.id] = r;
      persist();
      return r;
    }

    function amend(id, entry) {
      var old = byId[id];
      if (!old) throw new Error("amend: no record with id " + id);
      if (supersededIds[id]) throw new Error("amend: record " + id + " is already superseded by " + supersededIds[id] + " — amend that one");
      var r = makeRecord(entry, id);
      records.push(r);
      byId[r.id] = r;
      supersededIds[id] = r.id;
      persist();
      return r;
    }

    function get(id) { return byId[id] || null; }

    function recall(query) {
      query = (typeof query === "string") ? { text: query } : (query || {});
      var out = [];
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (!query.includeSuperseded && supersededIds[r.id]) continue;
        if (query.type && r.type !== query.type) continue;
        if (query.text && r.body.toLowerCase().indexOf(String(query.text).toLowerCase()) < 0) continue;
        out.push(r);
      }
      return out;
    }

    function timeline() { return records.slice(); }

    function exportSnapshot() { return JSON.stringify({ v: 1, records: records }); }

    function status() {
      var superseded = Object.keys(supersededIds).length;
      return {
        name: name,
        count: records.length,
        current: records.length - superseded,
        superseded: superseded,
        persisted: !!storage,
        storageErrors: storageErrors
      };
    }

    hydrate();

    // Note what is deliberately absent: no delete(), no forget(), no clear().
    return { remember: remember, amend: amend, get: get, recall: recall,
             timeline: timeline, exportSnapshot: exportSnapshot, status: status };
  }

  createMemory.CONFIDENCE = CONFIDENCE.slice();
  return createMemory;
});
