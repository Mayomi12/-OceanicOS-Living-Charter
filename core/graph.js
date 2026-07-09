/*
 * Ω∞ OceanicOS :: Knowledge Graph
 * Build 0027 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * The ocean already holds a graph — it was just never drawn. A decision is
 * GROUNDED ON the observations it cites; a piece of knowledge RESTS ON the
 * observations it learned from; a project LINKS the threads it gathers. The
 * Knowledge Graph reads those relationships straight out of the records and makes
 * them traversable: what supports this decision? what has been built on that
 * observation? what is this project connected to?
 *
 * It is DERIVED, never stored — build it from the current ocean at any moment and
 * it reflects exactly what is true now (superseded records are not nodes). Edges
 * point from the citing record to the thing it cites, and only connect nodes that
 * actually exist, so the graph never dangles.
 *
 *   createGraph({ oceanic })  — or  createGraph({ memory })
 *     .nodes() .edges() .neighbors(id) .out(id) .in(id) .edgesOf(id)
 *     .component(id) .stats() .toDOT()
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createGraph = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function logicalId(r) {
    var m = r.meta || {};
    return m.oid || m.did || m.kid || m.pid || (typeof m.number === "number" ? String(m.number) : null) || r.id;
  }
  function labelOf(r) {
    var b = String(r.body || "");
    return b.length > 60 ? b.slice(0, 60) + "…" : b;
  }

  function createGraph(options) {
    options = options || {};
    var memory = options.memory || (options.oceanic && options.oceanic.memory);
    if (!memory || typeof memory.recall !== "function") {
      throw new TypeError("createGraph requires an OceanicOS or a Memory: createGraph({ oceanic }) or createGraph({ memory })");
    }

    // ---- derive nodes + edges from the current ocean ----
    var records = memory.recall({});          // current records, all types
    var nodeById = {};
    var nodeList = [];
    records.forEach(function (r) {
      var id = logicalId(r);
      var node = { id: id, type: r.type, label: labelOf(r), status: (r.meta && r.meta.status) || null, at: r.at };
      nodeById[id] = node;
      nodeList.push(node);
    });

    var edgeList = [];
    var outAdj = {};   // id -> [edge]
    var inAdj = {};    // id -> [edge]
    var undirected = {}; // id -> Set-like {otherId:true}

    function addEdge(from, to, rel) {
      if (from === to) return;                 // no self-loops
      if (!nodeById[from] || !nodeById[to]) return; // never dangle — both ends must be real nodes
      var e = { from: from, to: to, rel: rel };
      edgeList.push(e);
      (outAdj[from] = outAdj[from] || []).push(e);
      (inAdj[to] = inAdj[to] || []).push(e);
      (undirected[from] = undirected[from] || {})[to] = true;
      (undirected[to] = undirected[to] || {})[from] = true;
    }

    records.forEach(function (r) {
      var id = logicalId(r);
      var m = r.meta || {};
      if ((r.type === "decision" || r.type === "knowledge") && Array.isArray(m.grounds)) {
        m.grounds.forEach(function (g) { addEdge(id, g, "grounds"); });
      }
      if (r.type === "project" && Array.isArray(m.links)) {
        m.links.forEach(function (l) { if (l && typeof l.id === "string") addEdge(id, l.id, "links:" + l.kind); });
      }
    });

    // ---- reads ----
    function nodes() { return nodeList.map(function (n) { return { id: n.id, type: n.type, label: n.label, status: n.status }; }); }
    function edges() { return edgeList.map(function (e) { return { from: e.from, to: e.to, rel: e.rel }; }); }
    function node(id) { var n = nodeById[id]; return n ? { id: n.id, type: n.type, label: n.label, status: n.status } : null; }
    function has(id) { return !!nodeById[id]; }

    function out(id) { return (outAdj[id] || []).map(function (e) { return { to: e.to, rel: e.rel }; }); }
    function inbound(id) { return (inAdj[id] || []).map(function (e) { return { from: e.from, rel: e.rel }; }); }
    function edgesOf(id) { return edgeList.filter(function (e) { return e.from === id || e.to === id; }).map(function (e) { return { from: e.from, to: e.to, rel: e.rel }; }); }

    function neighbors(id) {
      if (!nodeById[id]) return [];
      return Object.keys(undirected[id] || {});
    }

    // connected component (undirected reachability) from a node
    function component(id) {
      if (!nodeById[id]) return [];
      var seen = {}, stack = [id], comp = [];
      while (stack.length) {
        var cur = stack.pop();
        if (seen[cur]) continue;
        seen[cur] = true; comp.push(cur);
        Object.keys(undirected[cur] || {}).forEach(function (n) { if (!seen[n]) stack.push(n); });
      }
      return comp;
    }

    function stats() {
      var byType = {};
      nodeList.forEach(function (n) { byType[n.type] = (byType[n.type] || 0) + 1; });
      // count connected components
      var seen = {}, components = 0;
      nodeList.forEach(function (n) {
        if (seen[n.id]) return;
        components++;
        component(n.id).forEach(function (x) { seen[x] = true; });
      });
      return { nodes: nodeList.length, edges: edgeList.length, byType: byType, components: components };
    }

    function toDOT() {
      var lines = ["digraph OceanicOS {", "  rankdir=LR;", '  node [style=filled,fontname="monospace"];'];
      nodeList.forEach(function (n) {
        lines.push('  "' + n.id + '" [label="' + n.type + ": " + n.label.replace(/"/g, "'") + '"];');
      });
      edgeList.forEach(function (e) {
        lines.push('  "' + e.from + '" -> "' + e.to + '" [label="' + e.rel + '"];');
      });
      lines.push("}");
      return lines.join("\n");
    }

    return { nodes: nodes, edges: edges, node: node, has: has,
             out: out, in: inbound, edgesOf: edgesOf, neighbors: neighbors,
             component: component, stats: stats, toDOT: toDOT };
  }

  createGraph.logicalId = logicalId;
  return createGraph;
});
