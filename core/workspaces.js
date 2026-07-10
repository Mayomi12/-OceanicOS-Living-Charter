/*
 * Ω∞ OceanicOS :: Workspaces
 * Build 0037 · Stage 5 (Collaboration) · zero-runtime (plain browser or any JS engine)
 *
 * A workspace is a place people work together. Where a Project (0010) is
 * goal-centric (a named effort toward an outcome), a Workspace is actor-centric:
 * it records WHO is in it and WHAT it has gathered. It composes Identity (0035)
 * — every member must be a real registered actor — and persists in the one
 * Memory Ocean as `type:"workspace"`, so like everything else it is append-only:
 * a member is removed openly, never erased, and the record of who belonged when
 * remains.
 *
 *   create({ name, purpose })          → a workspace (born active)
 *   add(wid, actorId, role?)           → join a registered actor (member | lead)
 *   remove(wid, actorId)               → part ways (kept in history)
 *   link(wid, { kind, id })            → gather a record into the space
 *   members(wid) · byMember(actorId) · list() · get(wid) · close(wid)
 *
 * Nothing here overrides the Charter; membership is organisation, not authority.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createWorkspaces = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MEMBER_ROLES = ["member", "lead"];
  var LINK_KINDS = ["observation", "decision", "knowledge", "project", "build", "note"];

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace"; }

  function createWorkspaces(options) {
    options = options || {};
    var memory = options.memory || (options.oceanic && options.oceanic.memory);
    if (!memory || typeof memory.remember !== "function" || typeof memory.amend !== "function" || typeof memory.recall !== "function") {
      throw new TypeError("createWorkspaces requires an OceanicOS or a Memory: createWorkspaces({ oceanic })");
    }
    var identity = options.identity || null; // if given, members are validated against the register
    if (identity && typeof identity.has !== "function") throw new TypeError("createWorkspaces: identity, if provided, must be an Identity (needs has())");

    function spaces(includeClosed) {
      return memory.recall({ type: "workspace" }).filter(function (r) { return includeClosed || r.meta.status === "active"; });
    }
    function record(wid) {
      var all = memory.recall({ type: "workspace" });
      for (var i = 0; i < all.length; i++) if (all[i].meta.wid === wid) return all[i];
      return null;
    }
    function shape(r) {
      return r ? { id: r.meta.wid, name: r.body, purpose: r.meta.purpose, status: r.meta.status,
                   members: r.meta.members.map(function (m) { return { actor: m.actor, role: m.role }; }),
                   links: r.meta.links.map(function (l) { return { kind: l.kind, id: l.id }; }) } : null;
    }

    function save(rec, patch) {
      var m = rec.meta;
      return memory.amend(rec.id, {
        type: "workspace", body: rec.body, source: "workspaces", confidence: "certain",
        meta: {
          wid: m.wid,
          purpose: m.purpose,
          status: ("status" in patch) ? patch.status : m.status,
          members: ("members" in patch) ? patch.members : m.members,
          links: ("links" in patch) ? patch.links : m.links
        }
      });
    }

    function activeRecord(wid, verb) {
      var rec = record(wid);
      if (!rec) throw new Error("no workspace with id " + wid);
      if (rec.meta.status !== "active") throw new Error("workspace " + wid + " is closed — cannot " + (verb || "modify") + " it");
      return rec;
    }

    function create(entry) {
      if (!entry || typeof entry.name !== "string" || !entry.name) throw new TypeError("create requires a non-empty name");
      var wid = entry.id ? slug(entry.id) : slug(entry.name);
      if (record(wid)) throw new Error("a workspace already exists with id " + wid);
      var r = memory.remember({
        type: "workspace", body: entry.name, source: "workspaces", confidence: "certain",
        meta: { wid: wid, purpose: entry.purpose || null, status: "active", members: [], links: [] }
      });
      return shape(r);
    }

    function add(wid, actorId, role) {
      var rec = activeRecord(wid, "add members to");
      if (typeof actorId !== "string" || !actorId) throw new TypeError("add requires an actor id");
      if (identity && !identity.has(actorId)) throw new Error("no active actor '" + actorId + "' in the register");
      role = role || "member";
      if (MEMBER_ROLES.indexOf(role) < 0) throw new TypeError("workspace role must be one of: " + MEMBER_ROLES.join(", "));
      var members = rec.meta.members.slice();
      for (var i = 0; i < members.length; i++) {
        if (members[i].actor === actorId) { // already a member → update role openly
          members[i] = { actor: actorId, role: role };
          return shape(save(rec, { members: members }));
        }
      }
      members.push({ actor: actorId, role: role });
      return shape(save(rec, { members: members }));
    }

    function remove(wid, actorId) {
      var rec = activeRecord(wid, "remove members from");
      var members = rec.meta.members.filter(function (m) { return m.actor !== actorId; });
      if (members.length === rec.meta.members.length) throw new Error(actorId + " is not a member of " + wid);
      return shape(save(rec, { members: members }));
    }

    function link(wid, ref) {
      var rec = activeRecord(wid, "add to");
      if (!ref || typeof ref !== "object") throw new TypeError("link requires a reference: { kind, id }");
      if (LINK_KINDS.indexOf(ref.kind) < 0) throw new TypeError("link kind must be one of: " + LINK_KINDS.join(", "));
      if (typeof ref.id !== "string" || !ref.id) throw new TypeError("link requires a non-empty id");
      var links = rec.meta.links.slice();
      links.push({ kind: ref.kind, id: ref.id });
      return shape(save(rec, { links: links }));
    }

    function close(wid) {
      var rec = record(wid);
      if (!rec) throw new Error("no workspace with id " + wid);
      if (rec.meta.status !== "active") throw new Error("workspace " + wid + " is already closed");
      return shape(save(rec, { status: "closed" }));
    }

    function get(wid) { return shape(record(wid)); }
    function has(wid) { var r = record(wid); return !!r && r.meta.status === "active"; }
    function list(includeClosed) { return spaces(includeClosed).map(shape); }
    function members(wid) { var r = record(wid); if (!r) throw new Error("no workspace with id " + wid); return shape(r).members; }
    function byMember(actorId) {
      return spaces(false).filter(function (r) {
        return r.meta.members.some(function (m) { return m.actor === actorId; });
      }).map(shape);
    }
    function status() {
      var active = spaces(false), all = spaces(true);
      return { workspaces: active.length, closed: all.length - active.length,
               members: active.reduce(function (n, r) { return n + r.meta.members.length; }, 0) };
    }

    return { create: create, add: add, remove: remove, link: link, close: close,
             get: get, has: has, list: list, members: members, byMember: byMember, status: status };
  }

  createWorkspaces.MEMBER_ROLES = MEMBER_ROLES.slice();
  createWorkspaces.LINK_KINDS = LINK_KINDS.slice();
  return createWorkspaces;
});
