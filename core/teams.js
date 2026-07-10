/*
 * Ω∞ OceanicOS :: Teams
 * Build 0038 · Stage 5 (Collaboration) · zero-runtime (plain browser or any JS engine)
 *
 * A team is a portable, reusable GROUP of actors. Where a Workspace (0037) is a
 * scoped space that gathers records, a Team is just the people — a group that can
 * be formed once and referenced anywhere. It composes Identity (0035): every
 * member is a registered actor, and persists in the one Memory Ocean as
 * `type:"team"`, append-only (a member leaves openly; the record of who belonged
 * when is never erased).
 *
 * A team may CONFER a role. Rather than granting each person authority one by one,
 * a team can carry a role from the Identity ladder that flows to all its members.
 * `roleOf(actorId)` returns the highest role any of an actor's teams confers, so
 * Permissions (0036) can read team-derived authority — a team of stewards makes
 * its members stewards, for the purposes of what they may do.
 *
 *   form({ name, purpose, role? }) · join · leave · grant(tid, role)
 *   members · byMember · roleOf(actorId) · list · get · disband
 *
 * No team is authority over humans; the Charter's final authority is unchanged.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createTeams = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ROLES = ["observer", "contributor", "steward", "admin"]; // matches Identity's ladder
  function authority(role) { return ROLES.indexOf(role); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "team"; }

  function createTeams(options) {
    options = options || {};
    var memory = options.memory || (options.oceanic && options.oceanic.memory);
    if (!memory || typeof memory.remember !== "function" || typeof memory.amend !== "function" || typeof memory.recall !== "function") {
      throw new TypeError("createTeams requires an OceanicOS or a Memory: createTeams({ oceanic })");
    }
    var identity = options.identity || null;
    if (identity && typeof identity.has !== "function") throw new TypeError("createTeams: identity, if provided, must be an Identity (needs has())");

    function teamsOf(includeDisbanded) {
      return memory.recall({ type: "team" }).filter(function (r) { return includeDisbanded || r.meta.status === "active"; });
    }
    function record(tid) {
      var all = memory.recall({ type: "team" });
      for (var i = 0; i < all.length; i++) if (all[i].meta.tid === tid) return all[i];
      return null;
    }
    function shape(r) {
      return r ? { id: r.meta.tid, name: r.body, purpose: r.meta.purpose, role: r.meta.role, status: r.meta.status,
                   members: r.meta.members.slice() } : null;
    }
    function save(rec, patch) {
      var m = rec.meta;
      return memory.amend(rec.id, {
        type: "team", body: rec.body, source: "teams", confidence: "certain",
        meta: {
          tid: m.tid, purpose: m.purpose,
          role: ("role" in patch) ? patch.role : m.role,
          status: ("status" in patch) ? patch.status : m.status,
          members: ("members" in patch) ? patch.members : m.members
        }
      });
    }
    function activeRecord(tid, verb) {
      var rec = record(tid);
      if (!rec) throw new Error("no team with id " + tid);
      if (rec.meta.status !== "active") throw new Error("team " + tid + " is disbanded — cannot " + (verb || "modify") + " it");
      return rec;
    }

    function form(entry) {
      if (!entry || typeof entry.name !== "string" || !entry.name) throw new TypeError("form requires a non-empty name");
      var role = ("role" in entry) ? entry.role : null;
      if (role !== null && authority(role) < 0) throw new TypeError("a team's conferred role must be one of: " + ROLES.join(", ") + " (or null)");
      var tid = entry.id ? slug(entry.id) : slug(entry.name);
      if (record(tid)) throw new Error("a team already exists with id " + tid);
      var r = memory.remember({
        type: "team", body: entry.name, source: "teams", confidence: "certain",
        meta: { tid: tid, purpose: entry.purpose || null, role: role, status: "active", members: [] }
      });
      return shape(r);
    }

    function join(tid, actorId) {
      var rec = activeRecord(tid, "add members to");
      if (typeof actorId !== "string" || !actorId) throw new TypeError("join requires an actor id");
      if (identity && !identity.has(actorId)) throw new Error("no active actor '" + actorId + "' in the register");
      if (rec.meta.members.indexOf(actorId) >= 0) return shape(rec); // already a member — idempotent
      return shape(save(rec, { members: rec.meta.members.concat([actorId]) }));
    }

    function leave(tid, actorId) {
      var rec = activeRecord(tid, "remove members from");
      var members = rec.meta.members.filter(function (a) { return a !== actorId; });
      if (members.length === rec.meta.members.length) throw new Error(actorId + " is not a member of " + tid);
      return shape(save(rec, { members: members }));
    }

    function grant(tid, role) {
      var rec = activeRecord(tid, "grant a role to");
      if (role !== null && authority(role) < 0) throw new TypeError("role must be one of: " + ROLES.join(", ") + " (or null)");
      return shape(save(rec, { role: role }));
    }

    function disband(tid) {
      var rec = record(tid);
      if (!rec) throw new Error("no team with id " + tid);
      if (rec.meta.status !== "active") throw new Error("team " + tid + " is already disbanded");
      return shape(save(rec, { status: "disbanded" }));
    }

    function get(tid) { return shape(record(tid)); }
    function has(tid) { var r = record(tid); return !!r && r.meta.status === "active"; }
    function list(includeDisbanded) { return teamsOf(includeDisbanded).map(shape); }
    function members(tid) { var r = record(tid); if (!r) throw new Error("no team with id " + tid); return r.meta.members.slice(); }
    function byMember(actorId) {
      return teamsOf(false).filter(function (r) { return r.meta.members.indexOf(actorId) >= 0; }).map(shape);
    }

    // the highest role any of an actor's active teams confers (null if none)
    function roleOf(actorId) {
      var best = null;
      byMember(actorId).forEach(function (t) {
        if (t.role && (best === null || authority(t.role) > authority(best))) best = t.role;
      });
      return best;
    }

    function status() {
      var active = teamsOf(false), all = teamsOf(true);
      return { teams: active.length, disbanded: all.length - active.length,
               members: active.reduce(function (n, r) { return n + r.meta.members.length; }, 0) };
    }

    return { form: form, join: join, leave: leave, grant: grant, disband: disband,
             get: get, has: has, list: list, members: members, byMember: byMember, roleOf: roleOf, status: status };
  }

  createTeams.ROLES = ROLES.slice();
  return createTeams;
});
