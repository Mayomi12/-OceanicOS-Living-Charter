/*
 * Ω∞ OceanicOS :: Planning
 * Build 0029 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * Reasoning judges; Planning decides what to do about the judgement. Given the
 * Reasoner's audit (0028), the Planner turns a diagnosis into a prioritised,
 * deduplicated, ordered TO-DO list for a steward: revisit the decisions resting
 * on rejected reality, verify-or-reject the pending observations that others
 * depend on, reconfirm what stands on ground that has drifted.
 *
 * It is ADVISORY — it writes nothing and never fabricates a verification. The
 * Charter keeps humans (and agents acting honestly through the engines) as the
 * ones who actually verify, reverse, or deprecate. The Planner only says, in
 * order, what most needs attention and why.
 *
 * Priorities:
 *   1  fix what is broken or unsound (rests on missing / rejected reality)
 *   2  resolve the pending grounds that unsound-in-waiting records depend on
 *      (a shared ground is listed once, with a count of its dependents)
 *   3  attend to the remaining pending observations awaiting a verdict
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createPlanner = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function createPlanner(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || !os.reality || !os.decisions || !os.knowledge) {
      throw new TypeError("createPlanner requires an assembled OceanicOS: createPlanner({ oceanic })");
    }
    var reasoner = options.reasoner ||
      ((root && root.OceanicCore && typeof root.OceanicCore.createReasoner === "function") ? root.OceanicCore.createReasoner({ oceanic: os }) : null);
    if (!reasoner || typeof reasoner.audit !== "function") {
      throw new Error("createPlanner needs a Reasoner — load core/reason.js first, or pass createPlanner({ reasoner })");
    }

    function build() {
      var audit = reasoner.audit();
      var steps = [];
      var groundStep = {}; // groundId -> index in steps (dedup + dependents count)

      function verifyOrReject(gid, why) {
        if (groundStep[gid] != null) { steps[groundStep[gid]].dependents += 1; return; }
        groundStep[gid] = steps.length;
        steps.push({ priority: 2, action: "verify-or-reject", targetType: "observation", target: gid, reason: why, dependents: 1 });
      }

      audit.items.forEach(function (it) {
        if (it.soundness === "unsound") {
          steps.push({ priority: 1, action: "revisit", targetType: it.type, target: it.id,
            reason: "rests on a REJECTED observation — reverse or deprecate it", dependents: 0 });
        } else if (it.soundness === "broken") {
          steps.push({ priority: 1, action: "reground", targetType: it.type, target: it.id,
            reason: "a cited observation is missing — re-ground or retire it", dependents: 0 });
        } else if (it.soundness === "provisional") {
          var reconfirm = false;
          it.grounds.forEach(function (g) {
            if (g.status === "pending") verifyOrReject(g.id, "grounds a " + it.type + " that is only provisional until it is verified");
            else if (g.status !== "verified") reconfirm = true; // e.g. archived — cannot be re-verified
          });
          if (reconfirm) {
            steps.push({ priority: 2, action: "reconfirm", targetType: it.type, target: it.id,
              reason: "a ground has been archived — reconfirm this against current reality", dependents: 0 });
          }
        }
      });

      // remaining pending observations that nothing has already surfaced
      os.reality.byStatus("pending").forEach(function (o) {
        var oid = o.meta.oid;
        if (groundStep[oid] != null) return;
        steps.push({ priority: 3, action: "verify-or-reject", targetType: "observation", target: oid,
          reason: "a pending observation awaiting a verdict", dependents: 0 });
      });

      // order: priority asc, then more dependents first, then stable by target
      steps.sort(function (a, b) {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (b.dependents !== a.dependents) return b.dependents - a.dependents;
        return String(a.target) < String(b.target) ? -1 : 1;
      });
      steps.forEach(function (s, i) { s.order = i + 1; });
      return steps;
    }

    function plan() {
      var steps = build();
      var byAction = {};
      steps.forEach(function (s) { byAction[s.action] = (byAction[s.action] || 0) + 1; });
      return { steps: steps, total: steps.length, byAction: byAction, clear: steps.length === 0 };
    }

    function next() { var s = build(); return s.length ? s[0] : null; }

    return { plan: plan, next: next };
  }

  return createPlanner;
});
