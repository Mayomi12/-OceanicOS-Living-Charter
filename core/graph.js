/*
 * Ω∞ OceanicOS :: Knowledge Graph
 * Build 0029 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * The second Intelligence capability: the ocean's RELATIONSHIPS made visible
 * and walkable. createGraph() derives a typed graph from the one Memory Ocean
 * — it is a view, never a second store. Nodes are the real records
 * (observations · decisions · knowledge · projects · builds) plus the topics
 * knowledge declares. Edges exist only because a record SAYS so:
 *
 *   decision  --grounded-on-->  observation      (the decision's grounds)
 *   knowledge --grounded-on-->  observation      (the knowledge's grounds)
 *   knowledge --about-------->  topic            (the knowledge's topics)
 *   project   --links(kind)-->  linked record    (the project's typed links)
 *
 * The graph NEVER invents a connection: a ground naming something that is not
 * a record of this ocean produces no edge.
 *
 * Intelligence under the Charter (same contract family as Search, 0028):
 *   - grounded  → every node is a real record or a declared topic; every edge
 *                 a declared relationship.
 *   - current   → freshness is decidable: the append-only ocean's count moves
 *                 on every record and every open amendment, so the graph
 *                 rebuilds exactly when the ocean changes.
 *   - harmless  → building, querying, walking write nothing.
 *   - navigable → neighbors() and BFS path() with edge kinds reported.
 *
 * graph.html is the screen.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createGraph = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "0.29.0";

  function createGraph(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || typeof os.start !== "function" || !os.status) {
      throw new TypeError("createGraph requires an assembled OceanicOS: createGraph({ oceanic })");
    }
    var D = options.deps || (root && root.OceanicCore) || {};
    function need(fn, what) { if (typeof fn !== "function") throw new Error("createGraph: " + what + " factory is unavailable — load the Core scripts or pass { deps }"); return fn; }
    var logger = options.logger || need(D.createLogger, "logger")({ now: options.now, minLevel: "info" });

    var nodeById = {};   // id → { id, type, label, status }
    var edgeList = [];   // { from, to, kind }
    var builtAt = -1;
    var booted = false;

    function boot() {
      if (booted) return status();
      var b = os.start();
      booted = true;
      logger.info("graph online — OceanicOS v" + os.version + " booted on pulse " + b.pulse);
      return status();
    }

    function addNode(id, type, label, status) { nodeById[id] = { id: id, type: type, label: label, status: status }; }
    function addEdge(from, to, kind) {
      if (nodeById[from] && nodeById[to]) edgeList.push({ from: from, to: to, kind: kind });
    }

    function build() {
      nodeById = {};
      edgeList = [];

      var observations = os.reality.observations(false);
      var decisions    = os.decisions.decisions(false);
      var knowledge    = os.knowledge.knowledge(false);
      var projects     = os.projects.projects(false);
      var builds       = os.builds.history();

      observations.forEach(function (r) { addNode(r.meta.oid, "observation", r.body, r.meta.status); });
      decisions.forEach(function (r)    { addNode(r.meta.did, "decision",    r.body, r.meta.status); });
      knowledge.forEach(function (r)    { addNode(r.meta.kid, "knowledge",   r.body, r.meta.status); });
      projects.forEach(function (r)     { addNode(r.meta.pid, "project",     r.body, r.meta.status); });
      builds.forEach(function (r)       { addNode("build-" + r.meta.number, "build", r.meta.capability, "released"); });
      knowledge.forEach(function (r) {
        (r.meta.topics || []).forEach(function (t) {
          if (!nodeById["topic:" + t]) addNode("topic:" + t, "topic", t, "—");
        });
      });

      // edges: only what the records declare
      decisions.forEach(function (r) {
        (r.meta.grounds || []).forEach(function (g) { addEdge(r.meta.did, g, "grounded-on"); });
      });
      knowledge.forEach(function (r) {
        (r.meta.grounds || []).forEach(function (g) { addEdge(r.meta.kid, g, "grounded-on"); });
        (r.meta.topics || []).forEach(function (t) { addEdge(r.meta.kid, "topic:" + t, "about"); });
      });
      projects.forEach(function (r) {
        (r.meta.links || []).forEach(function (l) { addEdge(r.meta.pid, l.id, "links:" + l.kind); });
      });

      builtAt = os.status().memory.count;
      var n = Object.keys(nodeById).length;
      logger.info("graph built — " + n + " nodes, " + edgeList.length + " edges");
      return { nodes: n, edges: edgeList.length };
    }

    function fresh() { if (os.status().memory.count !== builtAt) build(); }

    function degreeOf(id) {
      var d = 0;
      edgeList.forEach(function (e) { if (e.from === id || e.to === id) d += 1; });
      return d;
    }

    function nodes(type) {
      fresh();
      var all = Object.keys(nodeById).map(function (k) { var n = nodeById[k]; return { id: n.id, type: n.type, label: n.label, status: n.status }; });
      return type ? all.filter(function (n) { return n.type === type; }) : all;
    }

    function edges(kind) {
      fresh();
      var all = edgeList.map(function (e) { return { from: e.from, to: e.to, kind: e.kind }; });
      return kind ? all.filter(function (e) { return e.kind === kind || e.kind.indexOf(kind + ":") === 0; }) : all;
    }

    function node(id) {
      fresh();
      var n = nodeById[id];
      return n ? { id: n.id, type: n.type, label: n.label, status: n.status, degree: degreeOf(id) } : null;
    }

    function neighbors(id, opts) {
      opts = opts || {};
      fresh();
      if (!nodeById[id]) return [];
      var out = [];
      edgeList.forEach(function (e) {
        var other = null, direction = null;
        if (e.from === id) { other = e.to; direction = "out"; }
        else if (e.to === id) { other = e.from; direction = "in"; }
        if (!other) return;
        if (opts.kind && e.kind !== opts.kind && e.kind.indexOf(opts.kind + ":") !== 0) return;
        var n = nodeById[other];
        out.push({ id: n.id, type: n.type, label: n.label, status: n.status, kind: e.kind, direction: direction });
      });
      return out;
    }

    function path(from, to) {
      fresh();
      if (!nodeById[from] || !nodeById[to]) return { found: false, hops: 0, steps: [] };
      if (from === to) return { found: true, hops: 0, steps: [{ node: shapeNode(from), via: null }] };
      var prev = {}; prev[from] = { id: null, via: null };
      var queue = [from];
      while (queue.length) {
        var cur = queue.shift();
        var done = false;
        for (var i = 0; i < edgeList.length; i++) {
          var e = edgeList[i];
          var next = e.from === cur ? e.to : (e.to === cur ? e.from : null);
          if (!next || prev[next] !== undefined) continue;
          prev[next] = { id: cur, via: e.kind };
          if (next === to) { done = true; break; }
          queue.push(next);
        }
        if (done) break;
      }
      if (prev[to] === undefined) return { found: false, hops: 0, steps: [] };
      var steps = [];
      var walk = to;
      while (walk !== null) {
        steps.unshift({ node: shapeNode(walk), via: prev[walk].via });
        walk = prev[walk].id;
      }
      return { found: true, hops: steps.length - 1, steps: steps };
    }

    function shapeNode(id) { var n = nodeById[id]; return { id: n.id, type: n.type, label: n.label, status: n.status }; }

    function orphans() {
      fresh();
      return Object.keys(nodeById).filter(function (id) { return degreeOf(id) === 0; }).map(shapeNode);
    }

    function stats() {
      fresh();
      var byType = {}, byKind = {};
      Object.keys(nodeById).forEach(function (id) { var t = nodeById[id].type; byType[t] = (byType[t] || 0) + 1; });
      edgeList.forEach(function (e) { byKind[e.kind] = (byKind[e.kind] || 0) + 1; });
      return { nodes: Object.keys(nodeById).length, edges: edgeList.length, byType: byType, byKind: byKind };
    }

    function status() {
      return { version: VERSION, booted: booted, nodes: Object.keys(nodeById).length,
               edges: edgeList.length, oceanAt: builtAt };
    }

    return {
      version: VERSION,
      boot: boot, build: build, nodes: nodes, edges: edges, node: node,
      neighbors: neighbors, path: path, orphans: orphans, stats: stats, status: status,
      oceanic: os, logger: logger
    };
  }

  createGraph.VERSION = VERSION;
  return createGraph;
});
