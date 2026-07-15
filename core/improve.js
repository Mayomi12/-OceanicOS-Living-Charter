/*
 * Ω∞ OceanicOS :: Continuous Improvement
 * Build 0062 · Stage 8 (Stewardship) · zero-runtime (plain browser or any JS engine)
 *
 * The last capability is the one that never finishes: the build doctrine
 * itself — Observe · Verify · Build one · Test · Record · Release · Learn ·
 * Repeat — turned into a capability the system can run on ITSELF.
 *
 *   observe()    → the system observes itself: one REAL observation recorded
 *                  into its own Reality Engine (grade, health gate, chores,
 *                  lessons) — pending, like all reality, until a steward
 *                  verifies it
 *   suggest()    → the doctrine's discipline: ONE next improvement, chosen by
 *                  evidence — P1 repairs before health blockers before
 *                  soundness before source hygiene; and when the system is
 *                  fully kept, the suggestion is the Final Law itself: build
 *                  the next capability. Improvement never ends.
 *   propose(by)  → file the suggestion as a GOVERNANCE proposal (0043) with
 *                  rationale, impact and plan — reviewed, quorum-gated,
 *                  ratified by a steward or not at all. This capability
 *                  NEVER enacts its own ideas: per the Charter, the system
 *                  proposes, humans decide.
 *   cycle(by)    → the whole loop, once: observe → suggest → propose —
 *                  ending, as it must, at the human gate
 *   history() · status()
 *
 * Composes Evaluation (0033) · Monitor (0047) · Maintenance (0061) ·
 * Learning (0030) · Reality (0007) · Governance (0043). Closes Stage 8 —
 * and keeps every stage after it open forever.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createImprovement = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var TAG = "continuous-improvement";

  function createImprovement(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || !os.reality || !os.memory) {
      throw new TypeError("createImprovement requires an assembled OceanicOS: createImprovement({ oceanic, identity, governance })");
    }
    var governance = options.governance;
    if (!governance || typeof governance.propose !== "function") {
      throw new TypeError("createImprovement requires Governance (0043) — the system proposes, humans decide");
    }
    var C = (root && root.OceanicCore) || {};
    function need(fn, made, what, deps) {
      if (made) return made;
      if (typeof fn === "function") return fn(deps || { oceanic: os });
      throw new Error("createImprovement needs " + what + " — load its module first, or pass it in");
    }
    var evaluator = need(C.createEvaluator, options.evaluator, "Evaluation (core/evaluate.js)");
    var maintenance = need(C.createMaintenance, options.maintenance, "Maintenance (core/maintenance.js)");
    var monitor = options.monitor || null;
    var learner = need(C.createLearner, options.learner, "Learning (core/learn.js)");
    var gradeBar = typeof options.gradeBar === "number" ? options.gradeBar : 90;

    /* ---- the signals, gathered once ---- */
    function signals() {
      var ev = evaluator.evaluate();
      var chores = maintenance.chores();
      var p1 = chores.filter(function (c) { return c.priority === 1; });
      var gate = monitor ? monitor.releaseGate() : null;
      var lessons = learner.lessons();
      return { evaluation: { score: ev.score, grade: ev.grade, issues: ev.issues },
               chores: { total: chores.length, p1: p1.length, first: chores.length ? chores[0] : null },
               gate: gate ? { release: gate.release, blockers: gate.blockers.map(function (b) { return b.id; }) } : null,
               lessons: lessons.length,
               unreliableSources: learner.unreliableSources(0.5, 2).length };
    }

    /* ---- observe: the system looks at itself, on the record ---- */
    function observe() {
      var s = signals();
      var body = "self-observation: grade " + s.evaluation.grade + " (" + s.evaluation.score + "/100), " +
        s.chores.total + " chore(s)" + (s.chores.p1 ? " (" + s.chores.p1 + " urgent)" : "") +
        (s.gate ? ", release gate " + (s.gate.release ? "open" : "BLOCKED") : "") +
        ", " + s.lessons + " lesson(s) learned";
      var o = os.reality.observe({ observation: body, source: TAG, evidence: JSON.stringify(s) });
      return { id: o.meta.oid, body: o.body, status: o.meta.status, signals: s };
    }

    /* ---- suggest: ONE next improvement, by evidence ----
     * accepts pre-gathered signals so a cycle judges the state it OBSERVED —
     * the self-observation itself (pending, as all reality) must not tilt
     * the verdict it feeds                                                */
    function suggest(pre) {
      var s = pre || signals();
      if (s.chores.p1 > 0) {
        return { focus: "repair", rationale: s.chores.p1 + " priority-1 chore(s) stand — nothing built on a broken foundation improves anything",
                 plan: "run maintenance.sweep(), act on the P1 chores first: " + s.chores.first.kind + " " + s.chores.first.target,
                 evidence: s };
      }
      if (s.gate && !s.gate.release) {
        return { focus: "health", rationale: "the release gate is blocked (" + s.gate.blockers.join(", ") + ") — an unhealthy system must not grow",
                 plan: "resolve the monitor's blockers, then re-check releaseGate()", evidence: s };
      }
      if (s.evaluation.score < gradeBar) {
        return { focus: "soundness", rationale: "self-evaluation is " + s.evaluation.grade + " (" + s.evaluation.score + "/100), below the bar of " + gradeBar + " — verify pending reality and revisit what is unsound",
                 plan: "work the planner's list until verified coverage and soundness raise the grade", evidence: s };
      }
      if (s.unreliableSources > 0) {
        return { focus: "source-hygiene", rationale: s.unreliableSources + " source(s) have earned distrust — future observations from them deserve harder checking",
                 plan: "review the learner's unreliable sources; require stronger evidence from them", evidence: s };
      }
      return { focus: "next-capability",
               rationale: "the system is kept, healthy and sound — per the Final Law, the improvement is to build the next verified capability that leaves reality better than before",
               plan: "observe a real need, design one capability, test it, record it, release it — and repeat", evidence: s };
    }

    /* ---- propose: file it with Governance; humans decide ---- */
    function propose(by, pre) {
      var s = suggest(pre);
      var n = history().length + 1;
      var p = governance.propose({
        title: "improve #" + n + ": " + s.focus,
        rationale: s.rationale,
        impact: TAG,
        plan: s.plan,
        by: by
      });
      return { proposal: p, suggestion: s };
    }

    /* ---- the loop, once — ending at the human gate ---- */
    function cycle(by) {
      var seen = observe();
      var filed = propose(by, seen.signals); // judge the state as observed
      return { observation: seen, suggestion: filed.suggestion, proposal: filed.proposal,
               note: "the loop ends where it must: a steward ratifies, or it does not happen" };
    }

    function history() {
      return governance.list().filter(function (p) { return p.impact === TAG; });
    }
    function status() {
      var all = history();
      var byStatus = {};
      all.forEach(function (p) { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
      return { proposals: all.length, byStatus: byStatus,
               selfObservations: os.memory.recall({ type: "observation" }).filter(function (r) { return r.source === TAG; }).length };
    }

    return { observe: observe, suggest: suggest, propose: propose, cycle: cycle,
             history: history, status: status, signals: signals };
  }

  createImprovement.TAG = TAG;
  return createImprovement;
});
