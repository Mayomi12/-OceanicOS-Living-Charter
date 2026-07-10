/*
 * Ω∞ OceanicOS :: Identity
 * Build 0035 · Stage 5 (Collaboration) · zero-runtime (plain browser or any JS engine)
 *
 * Collaboration begins with knowing WHO. Until now the ocean recorded what was
 * observed, decided, and known, but not by whom (beyond a free-text `source`).
 * Identity gives the system a register of actors — people and agents — each with
 * a name and a role, and a notion of the actor currently acting.
 *
 * Actors live in the one Memory Ocean like everything else (type "actor"), so
 * they are append-only and persistent: an actor is never deleted, only retired,
 * and a role change is an open amendment — the record of who held what authority
 * when is itself remembered. The Charter still holds above all of it: per
 * Article I §3, no role makes an actor an authority over humans.
 *
 * Roles form an authority ladder the next build (Permissions) will read:
 *   observer < contributor < steward < admin
 * A live `signIn` / `current` / `signOut` session tracks who is acting now
 * (runtime only — a session is not a permanent fact).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createIdentity = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ROLES = ["observer", "contributor", "steward", "admin"]; // ascending authority
  function authority(role) { return ROLES.indexOf(role); }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "actor";
  }

  function createIdentity(options) {
    options = options || {};
    var memory = options.memory || (options.oceanic && options.oceanic.memory);
    if (!memory || typeof memory.remember !== "function" || typeof memory.recall !== "function") {
      throw new TypeError("createIdentity requires an OceanicOS or a Memory: createIdentity({ oceanic }) or createIdentity({ memory })");
    }
    var currentAid = null;

    function actors(includeRetired) {
      return memory.recall({ type: "actor" }).filter(function (r) {
        return includeRetired || r.meta.status === "active";
      });
    }
    function record(aid) {
      var all = memory.recall({ type: "actor" });
      for (var i = 0; i < all.length; i++) if (all[i].meta.aid === aid) return all[i];
      return null;
    }
    function shape(r) { return r ? { id: r.meta.aid, name: r.body, role: r.meta.role, status: r.meta.status } : null; }

    function register(entry) {
      if (!entry || typeof entry.name !== "string" || !entry.name) throw new TypeError("register requires a non-empty name");
      var role = entry.role || "contributor";
      if (authority(role) < 0) throw new TypeError("role must be one of: " + ROLES.join(", "));
      var aid = entry.id ? slug(entry.id) : slug(entry.name);
      if (record(aid)) throw new Error("an actor already exists with id " + aid);
      var r = memory.remember({
        type: "actor", body: entry.name, source: "identity",
        confidence: "certain", meta: { aid: aid, role: role, status: "active" }
      });
      return shape(r);
    }

    function get(aid) { return shape(record(aid)); }
    function has(aid) { var r = record(aid); return !!r && r.meta.status === "active"; }
    function list(includeRetired) { return actors(includeRetired).map(shape); }
    function byRole(role) {
      if (authority(role) < 0) throw new TypeError("unknown role: " + role);
      return actors(false).filter(function (r) { return r.meta.role === role; }).map(shape);
    }

    function setRole(aid, role) {
      if (authority(role) < 0) throw new TypeError("role must be one of: " + ROLES.join(", "));
      var r = record(aid);
      if (!r) throw new Error("no actor with id " + aid);
      var amended = memory.amend(r.id, { type: "actor", body: r.body, source: "identity", confidence: "certain",
        meta: { aid: aid, role: role, status: r.meta.status } });
      return shape(amended);
    }

    function retire(aid) {
      var r = record(aid);
      if (!r) throw new Error("no actor with id " + aid);
      if (r.meta.status === "retired") throw new Error("actor " + aid + " is already retired");
      var amended = memory.amend(r.id, { type: "actor", body: r.body, source: "identity", confidence: "certain",
        meta: { aid: aid, role: r.meta.role, status: "retired" } });
      if (currentAid === aid) currentAid = null; // a retired actor cannot remain signed in
      return shape(amended);
    }

    /* ---- session: who is acting now (runtime only) ---- */
    function signIn(aid) {
      if (!has(aid)) throw new Error("cannot sign in as " + aid + " — no such active actor");
      currentAid = aid;
      return current();
    }
    function signOut() { currentAid = null; return null; }
    function current() { return currentAid ? get(currentAid) : null; }

    function status() {
      var all = actors(true);
      var byRoleCount = {};
      actors(false).forEach(function (r) { byRoleCount[r.meta.role] = (byRoleCount[r.meta.role] || 0) + 1; });
      return {
        actors: actors(false).length,
        retired: all.length - actors(false).length,
        byRole: byRoleCount,
        current: currentAid
      };
    }

    return {
      register: register, get: get, has: has, list: list, byRole: byRole,
      setRole: setRole, retire: retire,
      signIn: signIn, signOut: signOut, current: current,
      authority: function (role) { return authority(role); }, status: status
    };
  }

  createIdentity.ROLES = ROLES.slice();
  createIdentity.authority = authority;
  return createIdentity;
});
