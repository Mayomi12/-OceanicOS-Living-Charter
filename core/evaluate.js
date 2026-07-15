/*
 * Ω∞ OceanicOS :: Evaluation
 * Build 0033 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * The Intelligence stage closes by turning its own lenses on the whole system:
 * Evaluation is a scorecard. It composes what the earlier builds already learned
 * — the Reasoner's soundness audit (0028), the Learner's source reliability
 * (0030), the Graph's shape (0027) — into a few honest health metrics and one
 * overall grade, so the system can answer "how are we doing?" at a glance.
 *
 * The score is the mean of the metrics that apply right now:
 *   - verified coverage : how much observed reality has actually been verified.
 *   - soundness ratio   : of the records that cite grounds, how many are sound.
 *   - source reliability: the average trust earned by the sources (omitted from
 *                         the score while no source has a verdict yet — never
 *                         guessed).
 * Reported alongside (not scored): graph size, and the count of issues to fix.
 *
 * Pure — it reads the current ocean and computes; it writes nothing. An empty or
 * young ocean is treated fairly (vacuous metrics score 1, not 0).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createEvaluator = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function grade(score) {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }

  function createEvaluator(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || !os.reality || !os.decisions || !os.knowledge || !os.memory) {
      throw new TypeError("createEvaluator requires an assembled OceanicOS: createEvaluator({ oceanic })");
    }
    var C = (root && root.OceanicCore) || {};
    function need(fn, made, what) {
      if (made) return made;
      if (typeof fn === "function") return fn({ oceanic: os });
      throw new Error("createEvaluator needs a " + what + " — load core/" + what + ".js first, or pass it in");
    }
    var reasoner = need(C.createReasoner, options.reasoner, "reason");
    var learner  = need(C.createLearner, options.learner, "learn");
    var graph    = need(C.createGraph, options.graph, "graph");

    function evaluate() {
      // observations & verified coverage
      var obs = os.reality.observations(false);
      var oc = { total: obs.length, verified: 0, pending: 0, rejected: 0, archived: 0 };
      obs.forEach(function (o) { oc[o.meta.status] += 1; });
      var verifiedCoverage = oc.total ? oc.verified / oc.total : 1;

      // soundness of grounded records
      var audit = reasoner.audit().summary;
      var groundedTotal = audit.sound + audit.provisional + audit.unsound + audit.broken + audit.ungrounded;
      var withGrounds = groundedTotal - audit.ungrounded;
      var soundRatio = withGrounds ? audit.sound / withGrounds : 1;

      // source reliability
      var ls = learner.summary();
      var reliability = ls.avgReliability; // null when no source has a verdict yet

      // graph shape (reported, not scored)
      var gstats = graph.stats();

      // overall score = mean of the metrics that apply
      var parts = [verifiedCoverage, soundRatio];
      if (reliability != null) parts.push(reliability);
      var score = Math.round((parts.reduce(function (n, x) { return n + x; }, 0) / parts.length) * 100);

      return {
        score: score,
        grade: grade(score),
        metrics: {
          verifiedCoverage: round2(verifiedCoverage),
          soundnessRatio: round2(soundRatio),
          sourceReliability: reliability == null ? null : round2(reliability)
        },
        observations: oc,
        soundness: audit,
        sources: { count: ls.sources, unreliable: ls.unreliableSources },
        graph: { nodes: gstats.nodes, edges: gstats.edges, components: gstats.components },
        issues: audit.unsound + audit.broken,
        headline: headlineFor(score, grade(score), audit.unsound + audit.broken)
      };
    }

    function round2(x) { return Math.round(x * 100) / 100; }
    function headlineFor(score, g, issues) {
      return "Grade " + g + " (" + score + "/100)" +
        (issues > 0 ? " — " + issues + " issue" + (issues === 1 ? "" : "s") + " to revisit" : " — nothing unsound");
    }

    return { evaluate: evaluate };
  }

  createEvaluator.grade = grade;
  return createEvaluator;
});
