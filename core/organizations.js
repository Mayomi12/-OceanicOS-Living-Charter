/*
 * Ω∞ OceanicOS :: Organizations
 * Build 0039 · Stage 5 (Collaboration) · zero-runtime (plain browser or any JS engine)
 *
 * An organization is the umbrella: a container that gathers Teams (0038) and
 * Workspaces (0037) under one name. It owns no people directly — its people are
 * exactly the union of everyone in its teams and workspaces — so membership stays
 * defined in one place and an org's roster is always derived, never a second copy
 * that can drift.
 *
 * It composes Teams and Workspaces (to validate what it contains and to aggregate
 * members) and persists in the one Memory Ocean as `type:"org"`, append-only: a
 * team or workspace is removed from an org openly, and the org is dissolved, never
 * deleted.
 *
 *   found({ name, purpose }) · addTeam · addWorkspace · removeTeam · removeWorkspace
 *   teams(id) · workspaces(id) · members(id) · byMember(actorId) · list · get · dissolve
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createOrganizations = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "org"; }

  function createOrganizations(options) {
    options = options || {};
    var memory = options.memory || (options.oceanic && options.oceanic.memory);
    if (!memory || typeof memory.remember !== "function" || typeof memory.amend !== "function" || typeof memory.recall !== "function") {
      throw new TypeError("createOrganizations requires an OceanicOS or a Memory: createOrganizations({ oceanic })");
    }
    var teams = options.teams || null;           // for validation + member aggregation
    var workspaces = options.workspaces || null;
    if (teams && typeof teams.has !== "function") throw new TypeError("createOrganizations: teams, if provided, must be a Teams");
    if (workspaces && typeof workspaces.has !== "function") throw new TypeError("createOrganizations: workspaces, if provided, must be a Workspaces");

    function orgs(includeDissolved) {
      return memory.recall({ type: "org" }).filter(function (r) { return includeDissolved || r.meta.status === "active"; });
    }
    function record(id) {
      var all = memory.recall({ type: "org" });
      for (var i = 0; i < all.length; i++) if (all[i].meta.orgid === id) return all[i];
      return null;
    }
    function shape(r) {
      return r ? { id: r.meta.orgid, name: r.body, purpose: r.meta.purpose, status: r.meta.status,
                   teams: r.meta.teams.slice(), workspaces: r.meta.workspaces.slice() } : null;
    }
    function save(rec, patch) {
      var m = rec.meta;
      return memory.amend(rec.id, {
        type: "org", body: rec.body, source: "organizations", confidence: "certain",
        meta: {
          orgid: m.orgid, purpose: m.purpose,
          status: ("status" in patch) ? patch.status : m.status,
          teams: ("teams" in patch) ? patch.teams : m.teams,
          workspaces: ("workspaces" in patch) ? patch.workspaces : m.workspaces
        }
      });
    }
    function activeRecord(id, verb) {
      var rec = record(id);
      if (!rec) throw new Error("no organization with id " + id);
      if (rec.meta.status !== "active") throw new Error("organization " + id + " is dissolved — cannot " + (verb || "modify") + " it");
      return rec;
    }

    function found(entry) {
      if (!entry || typeof entry.name !== "string" || !entry.name) throw new TypeError("found requires a non-empty name");
      var id = entry.id ? slug(entry.id) : slug(entry.name);
      if (record(id)) throw new Error("an organization already exists with id " + id);
      var r = memory.remember({
        type: "org", body: entry.name, source: "organizations", confidence: "certain",
        meta: { orgid: id, purpose: entry.purpose || null, status: "active", teams: [], workspaces: [] }
      });
      return shape(r);
    }

    function addTeam(id, tid) {
      var rec = activeRecord(id, "add a team to");
      if (typeof tid !== "string" || !tid) throw new TypeError("addTeam requires a team id");
      if (teams && !teams.has(tid)) throw new Error("no active team '" + tid + "'");
      if (rec.meta.teams.indexOf(tid) >= 0) return shape(rec); // idempotent
      return shape(save(rec, { teams: rec.meta.teams.concat([tid]) }));
    }
    function addWorkspace(id, wid) {
      var rec = activeRecord(id, "add a workspace to");
      if (typeof wid !== "string" || !wid) throw new TypeError("addWorkspace requires a workspace id");
      if (workspaces && !workspaces.has(wid)) throw new Error("no active workspace '" + wid + "'");
      if (rec.meta.workspaces.indexOf(wid) >= 0) return shape(rec);
      return shape(save(rec, { workspaces: rec.meta.workspaces.concat([wid]) }));
    }
    function removeTeam(id, tid) {
      var rec = activeRecord(id, "remove a team from");
      var t = rec.meta.teams.filter(function (x) { return x !== tid; });
      if (t.length === rec.meta.teams.length) throw new Error("team " + tid + " is not in " + id);
      return shape(save(rec, { teams: t }));
    }
    function removeWorkspace(id, wid) {
      var rec = activeRecord(id, "remove a workspace from");
      var w = rec.meta.workspaces.filter(function (x) { return x !== wid; });
      if (w.length === rec.meta.workspaces.length) throw new Error("workspace " + wid + " is not in " + id);
      return shape(save(rec, { workspaces: w }));
    }

    function dissolve(id) {
      var rec = record(id);
      if (!rec) throw new Error("no organization with id " + id);
      if (rec.meta.status !== "active") throw new Error("organization " + id + " is already dissolved");
      return shape(save(rec, { status: "dissolved" }));
    }

    function get(id) { return shape(record(id)); }
    function has(id) { var r = record(id); return !!r && r.meta.status === "active"; }
    function list(includeDissolved) { return orgs(includeDissolved).map(shape); }
    function teamsOf(id) { var r = record(id); if (!r) throw new Error("no organization with id " + id); return r.meta.teams.slice(); }
    function workspacesOf(id) { var r = record(id); if (!r) throw new Error("no organization with id " + id); return r.meta.workspaces.slice(); }

    // the org's people = the union of everyone in its teams and workspaces (derived, never stored)
    function members(id) {
      var r = record(id);
      if (!r) throw new Error("no organization with id " + id);
      var set = {};
      if (teams) r.meta.teams.forEach(function (tid) {
        try { teams.members(tid).forEach(function (a) { set[a] = 1; }); } catch (e) {}
      });
      if (workspaces) r.meta.workspaces.forEach(function (wid) {
        try { workspaces.members(wid).forEach(function (m) { set[m.actor] = 1; }); } catch (e) {}
      });
      return Object.keys(set);
    }

    function byMember(actorId) {
      return orgs(false).filter(function (r) { return members(r.meta.orgid).indexOf(actorId) >= 0; }).map(shape);
    }

    function status() {
      var active = orgs(false), all = orgs(true);
      return {
        organizations: active.length,
        dissolved: all.length - active.length,
        teams: active.reduce(function (n, r) { return n + r.meta.teams.length; }, 0),
        workspaces: active.reduce(function (n, r) { return n + r.meta.workspaces.length; }, 0)
      };
    }

    return { found: found, addTeam: addTeam, addWorkspace: addWorkspace, removeTeam: removeTeam, removeWorkspace: removeWorkspace,
             dissolve: dissolve, get: get, has: has, list: list, teams: teamsOf, workspaces: workspacesOf,
             members: members, byMember: byMember, status: status };
  }

  return createOrganizations;
});
