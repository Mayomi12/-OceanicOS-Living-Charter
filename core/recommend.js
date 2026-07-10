/*
 * Ω∞ OceanicOS :: Recommendation
 * Build 0031 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * Given one thing, what else matters? Recommendation composes the two lenses
 * already built — the Knowledge Graph (0027) and Search (0026) — into relevance:
 *
 *  - related(id): starting from any record, the most relevant others, scored by
 *    how they relate. Direct connection (a decision that grounds on this
 *    observation, a project that links it) weighs most; being in the same cluster
 *    weighs less; merely sharing wording weighs least. Every recommendation says
 *    WHY it was suggested.
 *  - hubs(): the load-bearing records — the ones the most is connected to. These
 *    are where the system's understanding concentrates; verify or revisit them
 *    and the most rides on the outcome.
 *  - similar(text): free-text relevance for anything not yet in the ocean.
 *
 * Pure — it reads the current ocean and ranks; it writes nothing.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createRecommender = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var W_CONNECTED = 5, W_CLUSTER = 2, W_SIMILAR = 1;

  function createRecommender(options) {
    options = options || {};
    var os = options.oceanic;
    var C = (root && root.OceanicCore) || {};
    var graph = options.graph || (typeof C.createGraph === "function" && os ? C.createGraph({ oceanic: os }) : null);
    var search = options.search || (typeof C.createSearch === "function" && os ? C.createSearch({ oceanic: os }) : null);
    if (!graph || !search) {
      throw new Error("createRecommender needs a Graph and a Search — load core/graph.js and core/search.js first, or pass createRecommender({ graph, search })");
    }

    var nodeMap = {};
    graph.nodes().forEach(function (n) { nodeMap[n.id] = n; });

    function related(id, opts) {
      opts = opts || {};
      var limit = (typeof opts.limit === "number" && opts.limit > 0) ? opts.limit : 10;
      var self = nodeMap[id];
      if (!self) return [];

      var cand = {};
      function add(nid, w, reason, type, title) {
        if (nid === id || !nodeMap[nid] && !type) return; // must resolve to a real node
        var c = cand[nid] || (cand[nid] = { id: nid, score: 0, reasons: {}, type: type || (nodeMap[nid] && nodeMap[nid].type) || null, title: title || (nodeMap[nid] && nodeMap[nid].label) || null });
        c.score += w; c.reasons[reason] = true;
      }

      var neigh = graph.neighbors(id);
      var neighSet = {}; neigh.forEach(function (n) { neighSet[n] = true; });
      neigh.forEach(function (n) { add(n, W_CONNECTED, "directly connected"); });

      graph.component(id).forEach(function (n) {
        if (n !== id && !neighSet[n]) add(n, W_CLUSTER, "in the same cluster");
      });

      search.search(self.label, { limit: limit + 6 }).forEach(function (r) {
        if (r.id !== id) add(r.id, W_SIMILAR, "similar wording", r.type, r.title);
      });

      var out = Object.keys(cand).map(function (k) {
        var c = cand[k];
        return { id: c.id, type: c.type, title: c.title, score: c.score, reasons: Object.keys(c.reasons) };
      });
      out.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.id) < String(b.id) ? -1 : 1;
      });
      return out.slice(0, limit);
    }

    function hubs(opts) {
      opts = opts || {};
      var limit = (typeof opts.limit === "number" && opts.limit > 0) ? opts.limit : 10;
      var degree = {};
      graph.nodes().forEach(function (n) { degree[n.id] = 0; });
      graph.edges().forEach(function (e) { degree[e.from] += 1; degree[e.to] += 1; });
      return graph.nodes()
        .map(function (n) { return { id: n.id, type: n.type, title: n.label, status: n.status, degree: degree[n.id] || 0 }; })
        .filter(function (n) { return n.degree > 0; })
        .sort(function (a, b) { if (b.degree !== a.degree) return b.degree - a.degree; return String(a.id) < String(b.id) ? -1 : 1; })
        .slice(0, limit);
    }

    function similar(text, opts) {
      opts = opts || {};
      var limit = (typeof opts.limit === "number" && opts.limit > 0) ? opts.limit : 10;
      return search.search(String(text || ""), { limit: limit }).map(function (r) {
        return { id: r.id, type: r.type, title: r.title, score: r.score };
      });
    }

    return { related: related, hubs: hubs, similar: similar };
  }

  return createRecommender;
});
