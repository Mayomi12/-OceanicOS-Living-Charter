/*
 * Ω∞ OceanicOS :: Shared Knowledge
 * Build 0041 · Stage 5 (Collaboration) · zero-runtime (plain browser or any JS engine)
 *
 * Collaboration needs a way to ask "what does THIS space actually know?". A
 * Workspace (0037) gathers records — observations, decisions, knowledge — by
 * linking them. Shared Knowledge scopes the Intelligence lenses (Search 0026,
 * Knowledge Graph 0027) down to just those gathered records, so a team can
 * search, see, and traverse what belongs to their workspace without wading
 * through the whole Ocean.
 *
 *   knows(wid)          → the records a workspace has gathered (resolved, shaped)
 *   search(wid, query)  → search, restricted to the workspace's records
 *   connections(wid)    → the graph edges among the workspace's records
 *   unresolved(wid)     → links that point at no record (e.g. free-text notes)
 *   summary(wid)        → counts by type + connections + unresolved
 *
 * Pure — it reads the current Ocean and filters; it writes nothing. The Ocean
 * stays single and shared; a workspace is a lens onto it, never a copy.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createSharedKnowledge = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function logicalId(r) {
    var m = r.meta || {};
    return m.oid || m.did || m.kid || m.pid || (typeof m.number === "number" ? String(m.number) : null) || r.id;
  }
  function title(r) { var b = String(r.body || ""); return b.length > 70 ? b.slice(0, 70) + "…" : b; }

  function createSharedKnowledge(options) {
    options = options || {};
    var oceanic = options.oceanic;
    var memory = options.memory || (oceanic && oceanic.memory);
    if (!memory || typeof memory.recall !== "function") {
      throw new TypeError("createSharedKnowledge requires an OceanicOS or a Memory: createSharedKnowledge({ oceanic })");
    }
    var workspaces = options.workspaces;
    if (!workspaces || typeof workspaces.get !== "function") {
      throw new TypeError("createSharedKnowledge requires a Workspaces: createSharedKnowledge({ oceanic, workspaces })");
    }
    var C = (root && root.OceanicCore) || {};
    var search = options.search || (typeof C.createSearch === "function" ? C.createSearch({ oceanic: oceanic, memory: memory }) : null);
    if (!search) throw new Error("createSharedKnowledge needs Search — load core/search.js first, or pass { search }");
    var graphFactory = options.graphFactory || C.createGraph || null; // built fresh per call so it reflects the current Ocean

    function linkedIds(wid) {
      var ws = workspaces.get(wid);
      if (!ws) throw new Error("no workspace with id " + wid);
      var seen = {}, ids = [];
      ws.links.forEach(function (l) { if (!seen[l.id]) { seen[l.id] = 1; ids.push(l.id); } });
      return ids;
    }
    function currentById() {
      var map = {};
      memory.recall({}).forEach(function (r) { map[logicalId(r)] = r; });
      return map;
    }

    function knows(wid) {
      var byId = currentById();
      return linkedIds(wid).map(function (id) { return byId[id]; }).filter(Boolean)
        .map(function (r) { return { id: logicalId(r), type: r.type, title: title(r), status: (r.meta && r.meta.status) || null }; });
    }
    function unresolved(wid) {
      var byId = currentById();
      return linkedIds(wid).filter(function (id) { return !byId[id]; });
    }
    function search_(wid, query, opts) {
      var set = {};
      linkedIds(wid).forEach(function (id) { set[id] = 1; });
      return search.search(query, opts).filter(function (r) { return set[r.id]; });
    }
    function connections(wid) {
      if (!graphFactory) return [];
      var set = {};
      linkedIds(wid).forEach(function (id) { set[id] = 1; });
      var g = graphFactory({ oceanic: oceanic, memory: memory }); // fresh snapshot of the current Ocean
      return g.edges().filter(function (e) { return set[e.from] && set[e.to]; });
    }
    function summary(wid) {
      var recs = knows(wid);
      var byType = {};
      recs.forEach(function (r) { byType[r.type] = (byType[r.type] || 0) + 1; });
      return { records: recs.length, byType: byType, connections: connections(wid).length, unresolved: unresolved(wid).length };
    }

    return { knows: knows, search: search_, connections: connections, unresolved: unresolved, summary: summary };
  }

  createSharedKnowledge.logicalId = logicalId;
  return createSharedKnowledge;
});
