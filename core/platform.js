/*
 * Ω∞ OceanicOS :: Developer Platform
 * Build 0053 · Stage 7 (Ecosystem) · zero-runtime (plain browser or any JS engine)
 *
 * An ecosystem needs a FRONT DOOR for builders who are not the system's own
 * crew: third-party apps that act through a gated, audited surface instead of
 * raw engine access. The Platform composes the API (0017, the stable contract),
 * Identity (0035, every app has a responsible OWNER), and the Logger (0014,
 * every call leaves evidence):
 *
 *   registerApp({ name, owner, scopes }) → { appId, key, ... }  — the key is
 *       shown ONCE and lives only in runtime memory; the app's record in the
 *       ocean (type:"app") carries owner + scopes + status but NEVER the key
 *   client(key)   → the app's gated API: call(op, params) succeeds only for
 *       operations within the app's scopes ("reality.observe", "reality.*",
 *       or "*"); everything else refuses { ok:false } — never thrown
 *   revoke(appId, reason) → open amendment; a revoked app's key goes dead on
 *       the very next call, and the reason is on the record forever
 *   apps() · get(appId) · usage(appId) — the register and the audit counters
 *
 * Scopes gate WHICH operations an app may attempt; the engines' own laws still
 * apply underneath (an in-scope decide on an unverified ground is still
 * refused by the Decision Engine). Least privilege, evidence, no silent doors.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createPlatform = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app"; }

  function inScope(scopes, op) {
    for (var i = 0; i < scopes.length; i++) {
      var s = scopes[i];
      if (s === "*") return true;
      if (s === op) return true;
      if (s.slice(-2) === ".*" && op.indexOf(s.slice(0, -1)) === 0) return true; // "reality.*" matches "reality.x"
    }
    return false;
  }

  function createPlatform(options) {
    options = options || {};
    var memory = options.memory || (options.oceanic && options.oceanic.memory);
    if (!memory || typeof memory.remember !== "function" || typeof memory.amend !== "function") {
      throw new TypeError("createPlatform requires an OceanicOS or a Memory: createPlatform({ oceanic, api, identity })");
    }
    var api = options.api;
    if (!api || typeof api.call !== "function") throw new TypeError("createPlatform requires an API (0017): createPlatform({ oceanic, api, identity })");
    var identity = options.identity;
    if (!identity || typeof identity.has !== "function") throw new TypeError("createPlatform requires an Identity (0035): createPlatform({ oceanic, api, identity })");
    var logger = options.logger || null;
    var seq = 0;
    var keygen = options.keygen || function (appId) {
      seq += 1;
      return "ok_" + appId + "_" + seq + "_" + Math.random().toString(16).slice(2, 10);
    };

    var keys = {};   // key -> appId (RUNTIME ONLY — keys are never written to the ocean)
    var usageBy = {}; // appId -> { calls, denied, byOp }

    function log(level, msg, meta) { if (logger) try { logger[level](msg, meta); } catch (e) {} }

    /* ---- the register (in the one ocean, append-only, key-free) ---- */
    function appsOf() { return memory.recall({ type: "app" }); }
    function record(appId) {
      var all = appsOf();
      for (var i = 0; i < all.length; i++) if (all[i].meta.appId === appId) return all[i];
      return null;
    }
    function shape(r) {
      var m = r.meta;
      return { id: m.appId, name: r.body, owner: m.owner, scopes: m.scopes.slice(),
               status: m.status, reason: m.reason || null };
    }

    function registerApp(entry) {
      if (!entry || typeof entry.name !== "string" || !entry.name) throw new TypeError("registerApp requires a name");
      if (typeof entry.owner !== "string" || !identity.has(entry.owner)) {
        throw new Error("every app needs a responsible OWNER — '" + (entry.owner || "") + "' is not an active actor in the register");
      }
      if (!Array.isArray(entry.scopes) || !entry.scopes.length) {
        throw new TypeError("registerApp requires scopes — least privilege means saying what the app may do");
      }
      var appId = slug(entry.id || entry.name);
      if (record(appId)) throw new Error("an app already exists with id " + appId);
      memory.remember({
        type: "app", body: entry.name, source: "platform", confidence: "certain",
        meta: { appId: appId, owner: entry.owner, scopes: entry.scopes.slice(), status: "active", reason: null }
      });
      var key = keygen(appId);
      keys[key] = appId;
      usageBy[appId] = { calls: 0, denied: 0, byOp: {} };
      log("info", "platform · app '" + appId + "' registered by " + entry.owner + " (scopes: " + entry.scopes.join(", ") + ")");
      return { appId: appId, key: key, name: entry.name, owner: entry.owner, scopes: entry.scopes.slice(), status: "active" };
    }

    function revoke(appId, reason) {
      var rec = record(appId);
      if (!rec) throw new Error("no app with id " + appId);
      if (rec.meta.status === "revoked") throw new Error("app " + appId + " is already revoked");
      if (typeof reason !== "string" || !reason) throw new TypeError("revoke requires a reason — access must not vanish silently");
      var amended = memory.amend(rec.id, {
        type: "app", body: rec.body, source: "platform", confidence: "certain",
        meta: { appId: appId, owner: rec.meta.owner, scopes: rec.meta.scopes, status: "revoked", reason: reason }
      });
      log("warn", "platform · app '" + appId + "' revoked: " + reason);
      return shape(amended);
    }

    /* ---- the gated, audited client ---- */
    function client(key) {
      var appId = keys[key];
      if (!appId) throw new Error("unknown key — register the app first (or the key was minted by another platform instance)");
      function tally(op, ok) {
        var u = usageBy[appId];
        u.calls += 1;
        if (!ok) u.denied += 1;
        u.byOp[op] = (u.byOp[op] || 0) + 1;
      }
      return {
        app: appId,
        call: function (op, params) {
          var rec = record(appId);
          if (!rec || rec.meta.status !== "active") {
            tally(op, false);
            log("warn", "platform · " + appId + " → " + op + " REFUSED (app revoked)");
            return { ok: false, op: op, data: null, error: "app '" + appId + "' is revoked — " + (rec ? rec.meta.reason : "no record") };
          }
          if (!inScope(rec.meta.scopes, op)) {
            tally(op, false);
            log("warn", "platform · " + appId + " → " + op + " REFUSED (out of scope)");
            return { ok: false, op: op, data: null, error: "out of scope for app '" + appId + "' — granted: " + rec.meta.scopes.join(", ") };
          }
          var result = api.call(op, params);
          tally(op, result.ok);
          log(result.ok ? "info" : "warn", "platform · " + appId + " → " + op + (result.ok ? " ✓" : " ✗ — " + result.error));
          return result;
        },
        describe: function () {
          var rec = record(appId);
          var scopes = rec ? rec.meta.scopes : [];
          var all = api.describe ? api.describe() : { operations: [] };
          return { app: appId, scopes: scopes.slice(),
                   operations: all.operations.filter(function (o) { return inScope(scopes, o.name); }) };
        }
      };
    }

    function apps() { return appsOf().map(shape); }
    function get(appId) { var r = record(appId); return r ? shape(r) : null; }
    function usage(appId) {
      if (!record(appId)) throw new Error("no app with id " + appId);
      var u = usageBy[appId] || { calls: 0, denied: 0, byOp: {} };
      var byOp = {}; Object.keys(u.byOp).forEach(function (k) { byOp[k] = u.byOp[k]; });
      return { app: appId, calls: u.calls, denied: u.denied, byOp: byOp };
    }
    function status() {
      var all = apps();
      return { apps: all.length,
               active: all.filter(function (a) { return a.status === "active"; }).length,
               revoked: all.filter(function (a) { return a.status === "revoked"; }).length };
    }

    return { registerApp: registerApp, revoke: revoke, client: client,
             apps: apps, get: get, usage: usage, status: status };
  }

  createPlatform.inScope = inScope;
  return createPlatform;
});
