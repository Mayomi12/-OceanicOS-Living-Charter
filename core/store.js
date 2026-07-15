/*
 * Ω∞ OceanicOS :: Persistence Store
 * Build 0024 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * Until now every app started with an empty ocean each time it loaded — nothing
 * survived a refresh. The Store gives OceanicOS durable memory: it saves and
 * restores named snapshots of the Memory Ocean to a storage backend (browser
 * localStorage, or any getItem/setItem/removeItem object), so a session — or a
 * whole workspace — can be closed and reopened without loss.
 *
 * It keeps the Charter's spirit even at the persistence layer:
 *  - HONEST ABOUT FAILURE. Storage can be full or blocked; every write is
 *    quota-safe — a failed save returns { ok:false, error } and NEVER throws, so
 *    an app can tell the user rather than crash.
 *  - AN INDEX, NOT GUESSWORK. The Store maintains its own index of saved names,
 *    so list()/has() are exact and don't depend on scanning foreign keys.
 *  - PORTABLE. export()/import() move an entire set of snapshots as one JSON
 *    bundle — backup, transfer, or seed.
 *
 * A snapshot is just a string (e.g. oceanic.exportSnapshot()); the Store does
 * not interpret it, so it works for any serialisable payload.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createStore = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function createStore(options) {
    options = options || {};
    var backend = options.backend || (root && root.localStorage) || null;
    if (!backend || typeof backend.getItem !== "function" || typeof backend.setItem !== "function") {
      throw new TypeError("createStore requires a storage backend with getItem/setItem (localStorage-compatible): createStore({ backend })");
    }
    var ns = (options.namespace || "oceanic.store") + ".";
    var indexKey = ns + "@index";

    function readIndex() {
      try {
        var raw = backend.getItem(indexKey);
        var arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    }
    function writeIndex(names) {
      try { backend.setItem(indexKey, JSON.stringify(names)); return true; }
      catch (e) { return false; }
    }
    function validName(name) { return typeof name === "string" && !!name && name.indexOf("@") !== 0; }
    function keyOf(name) { return ns + name; }

    function save(name, snapshot) {
      if (!validName(name)) throw new TypeError("save requires a non-empty name (not starting with '@')");
      if (typeof snapshot !== "string") throw new TypeError("save requires a string snapshot");
      try { backend.setItem(keyOf(name), snapshot); }
      catch (e) { return { ok: false, name: name, error: "storage write failed (quota or blocked): " + (e && e.message ? e.message : e) }; }
      var names = readIndex();
      if (names.indexOf(name) < 0) { names.push(name); writeIndex(names); }
      return { ok: true, name: name, bytes: snapshot.length };
    }

    function load(name) {
      if (!validName(name)) return null;
      try { return backend.getItem(keyOf(name)); } catch (e) { return null; }
    }

    function has(name) { return validName(name) && readIndex().indexOf(name) >= 0; }

    function list() { return readIndex().slice(); }

    function remove(name) {
      if (!has(name)) return false;
      try { if (typeof backend.removeItem === "function") backend.removeItem(keyOf(name)); else backend.setItem(keyOf(name), ""); } catch (e) {}
      var names = readIndex().filter(function (n) { return n !== name; });
      writeIndex(names);
      return true;
    }

    function exportBundle() {
      var names = readIndex();
      var snapshots = {};
      names.forEach(function (n) { snapshots[n] = load(n); });
      return JSON.stringify({ v: 1, namespace: ns, snapshots: snapshots });
    }

    function importBundle(bundle, opts) {
      opts = opts || {};
      var parsed;
      try { parsed = JSON.parse(bundle); } catch (e) { return { ok: false, error: "bundle is not valid JSON" }; }
      if (!parsed || typeof parsed.snapshots !== "object" || !parsed.snapshots) return { ok: false, error: "bundle has no snapshots" };
      var imported = 0, skipped = 0, failed = 0;
      Object.keys(parsed.snapshots).forEach(function (name) {
        if (!validName(name) || typeof parsed.snapshots[name] !== "string") { failed++; return; }
        if (has(name) && !opts.overwrite) { skipped++; return; }
        var r = save(name, parsed.snapshots[name]);
        if (r.ok) imported++; else failed++;
      });
      return { ok: failed === 0, imported: imported, skipped: skipped, failed: failed };
    }

    function status() {
      var names = readIndex();
      var bytes = 0;
      names.forEach(function (n) { var s = load(n); bytes += s ? s.length : 0; });
      return { count: names.length, bytes: bytes, namespace: ns };
    }

    return { save: save, load: load, has: has, list: list, remove: remove,
             exportBundle: exportBundle, importBundle: importBundle, status: status };
  }

  return createStore;
});
