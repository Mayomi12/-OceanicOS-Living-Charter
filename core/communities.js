/*
 * Ω∞ OceanicOS :: Communities
 * Build 0040 · Stage 5 (Collaboration) · zero-runtime (plain browser or any JS engine)
 *
 * A community is an OPEN group gathered around a topic. Where a Team (0038) is
 * curated (someone forms it and adds people, and it may confer authority), a
 * community is joined freely: any registered actor may join or leave on their
 * own. It carries a topic so communities can be discovered by interest, and it
 * can adopt shared Workspaces (0037) where its members collaborate.
 *
 * It composes Identity (members are registered actors) and, optionally,
 * Workspaces (its shared spaces), and persists in the one Memory Ocean as
 * `type:"community"`, append-only — leaving is open, archiving is not deletion.
 *
 *   open({ name, topic, purpose }) · join · leave · addSpace · removeSpace
 *   members · spaces · byMember · byTopic · list (by popularity) · get · archive
 *
 * Community membership is belonging, not authority — the Charter is unchanged.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createCommunities = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "community"; }

  function createCommunities(options) {
    options = options || {};
    var memory = options.memory || (options.oceanic && options.oceanic.memory);
    if (!memory || typeof memory.remember !== "function" || typeof memory.amend !== "function" || typeof memory.recall !== "function") {
      throw new TypeError("createCommunities requires an OceanicOS or a Memory: createCommunities({ oceanic })");
    }
    var identity = options.identity || null;
    var workspaces = options.workspaces || null;
    if (identity && typeof identity.has !== "function") throw new TypeError("createCommunities: identity, if provided, must be an Identity");
    if (workspaces && typeof workspaces.has !== "function") throw new TypeError("createCommunities: workspaces, if provided, must be a Workspaces");

    function communitiesOf(includeArchived) {
      return memory.recall({ type: "community" }).filter(function (r) { return includeArchived || r.meta.status === "active"; });
    }
    function record(cid) {
      var all = memory.recall({ type: "community" });
      for (var i = 0; i < all.length; i++) if (all[i].meta.cid === cid) return all[i];
      return null;
    }
    function shape(r) {
      return r ? { id: r.meta.cid, name: r.body, topic: r.meta.topic, purpose: r.meta.purpose, status: r.meta.status,
                   members: r.meta.members.slice(), spaces: r.meta.spaces.slice() } : null;
    }
    function save(rec, patch) {
      var m = rec.meta;
      return memory.amend(rec.id, {
        type: "community", body: rec.body, source: "communities", confidence: "certain",
        meta: {
          cid: m.cid, topic: m.topic, purpose: m.purpose,
          status: ("status" in patch) ? patch.status : m.status,
          members: ("members" in patch) ? patch.members : m.members,
          spaces: ("spaces" in patch) ? patch.spaces : m.spaces
        }
      });
    }
    function activeRecord(cid, verb) {
      var rec = record(cid);
      if (!rec) throw new Error("no community with id " + cid);
      if (rec.meta.status !== "active") throw new Error("community " + cid + " is archived — cannot " + (verb || "modify") + " it");
      return rec;
    }

    function open(entry) {
      if (!entry || typeof entry.name !== "string" || !entry.name) throw new TypeError("open requires a non-empty name");
      var cid = entry.id ? slug(entry.id) : slug(entry.name);
      if (record(cid)) throw new Error("a community already exists with id " + cid);
      var r = memory.remember({
        type: "community", body: entry.name, source: "communities", confidence: "certain",
        meta: { cid: cid, topic: entry.topic ? String(entry.topic).toLowerCase() : null, purpose: entry.purpose || null,
                status: "active", members: [], spaces: [] }
      });
      return shape(r);
    }

    function join(cid, actorId) {
      var rec = activeRecord(cid, "join");
      if (typeof actorId !== "string" || !actorId) throw new TypeError("join requires an actor id");
      if (identity && !identity.has(actorId)) throw new Error("no active actor '" + actorId + "' in the register");
      if (rec.meta.members.indexOf(actorId) >= 0) return shape(rec); // idempotent — open, self-service
      return shape(save(rec, { members: rec.meta.members.concat([actorId]) }));
    }
    function leave(cid, actorId) {
      var rec = activeRecord(cid, "leave");
      var members = rec.meta.members.filter(function (a) { return a !== actorId; });
      if (members.length === rec.meta.members.length) throw new Error(actorId + " is not a member of " + cid);
      return shape(save(rec, { members: members }));
    }
    function addSpace(cid, wid) {
      var rec = activeRecord(cid, "add a space to");
      if (typeof wid !== "string" || !wid) throw new TypeError("addSpace requires a workspace id");
      if (workspaces && !workspaces.has(wid)) throw new Error("no active workspace '" + wid + "'");
      if (rec.meta.spaces.indexOf(wid) >= 0) return shape(rec);
      return shape(save(rec, { spaces: rec.meta.spaces.concat([wid]) }));
    }
    function removeSpace(cid, wid) {
      var rec = activeRecord(cid, "remove a space from");
      var spaces = rec.meta.spaces.filter(function (x) { return x !== wid; });
      if (spaces.length === rec.meta.spaces.length) throw new Error("workspace " + wid + " is not a space of " + cid);
      return shape(save(rec, { spaces: spaces }));
    }
    function archive(cid) {
      var rec = record(cid);
      if (!rec) throw new Error("no community with id " + cid);
      if (rec.meta.status !== "active") throw new Error("community " + cid + " is already archived");
      return shape(save(rec, { status: "archived" }));
    }

    function get(cid) { return shape(record(cid)); }
    function has(cid) { var r = record(cid); return !!r && r.meta.status === "active"; }
    function members(cid) { var r = record(cid); if (!r) throw new Error("no community with id " + cid); return r.meta.members.slice(); }
    function spaces(cid) { var r = record(cid); if (!r) throw new Error("no community with id " + cid); return r.meta.spaces.slice(); }
    function byMember(actorId) {
      return communitiesOf(false).filter(function (r) { return r.meta.members.indexOf(actorId) >= 0; }).map(shape);
    }
    function byTopic(topic) {
      var t = String(topic || "").toLowerCase();
      return communitiesOf(false).filter(function (r) { return r.meta.topic === t; }).map(shape);
    }
    // most popular first
    function list(includeArchived) {
      return communitiesOf(includeArchived).map(shape).sort(function (a, b) {
        if (b.members.length !== a.members.length) return b.members.length - a.members.length;
        return a.id < b.id ? -1 : 1;
      });
    }
    function status() {
      var active = communitiesOf(false), all = communitiesOf(true);
      return { communities: active.length, archived: all.length - active.length,
               members: active.reduce(function (n, r) { return n + r.meta.members.length; }, 0),
               topics: Object.keys(active.reduce(function (o, r) { if (r.meta.topic) o[r.meta.topic] = 1; return o; }, {})).length };
    }

    return { open: open, join: join, leave: leave, addSpace: addSpace, removeSpace: removeSpace, archive: archive,
             get: get, has: has, list: list, members: members, spaces: spaces, byMember: byMember, byTopic: byTopic, status: status };
  }

  return createCommunities;
});
