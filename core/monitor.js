/*
 * Ω∞ OceanicOS :: Monitoring
 * Build 0047 · Stage 6 (Infrastructure) · zero-runtime (plain browser or any JS engine)
 *
 * Infrastructure means the system can be OPERATED — and an operated system must
 * be watchable. Monitoring composes the dials that already exist — Heartbeat
 * (0003, is it beating?), Memory (0005, is storage holding?), the Logger (0014,
 * what did it do?), the Reasoner (0028, is anything unsound?), Evaluation
 * (0033, what grade does it earn?) — into one live health surface:
 *
 *   gauges()      → the raw dials, one snapshot
 *   checks()      → named health checks, each pass | warn | fail with a reason
 *   healthy()     → true iff NO check fails (warnings allowed — but visible)
 *   releaseGate() → { release, blockers, cautions, headline } — the seed of
 *                   CI/CD's question: "is this healthy enough to release?"
 *   sample()      → take a snapshot AND write it to the operational log, at
 *                   info when healthy and error when not
 *
 * Doctrine notes: silence is not success — a system with NO logger attached is
 * warned about, because unobserved is a risk; and monitoring never heals or
 * hides — it reads, judges, and reports. Humans (or Automation 0016) act.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createMonitor = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function createMonitor(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || !os.reality || !os.memory || !os.heartbeat) {
      throw new TypeError("createMonitor requires an assembled OceanicOS: createMonitor({ oceanic })");
    }
    var C = (root && root.OceanicCore) || {};
    function need(fn, made, what) {
      if (made) return made;
      if (typeof fn === "function") return fn({ oceanic: os });
      throw new Error("createMonitor needs a " + what + " — load core/" + what + ".js first, or pass it in");
    }
    var reasoner = need(C.createReasoner, options.reasoner, "reason");
    var evaluator = options.evaluator ||
      (typeof C.createEvaluator === "function"
        ? C.createEvaluator({ oceanic: os, reasoner: reasoner, learner: options.learner, graph: options.graph })
        : null);
    if (!evaluator) throw new Error("createMonitor needs an Evaluator — load core/evaluate.js first, or pass { evaluator }");
    var logger = options.logger || null; // optional — its absence is itself a finding
    var t = options.thresholds || {};
    var pendingBacklog = typeof t.pendingBacklog === "number" ? t.pendingBacklog : 10;
    var minScore = typeof t.minScore === "number" ? t.minScore : 70;

    /* ---- the raw dials ---- */
    function gauges() {
      var hb = os.heartbeat.status();
      var obs = os.reality.observations(false);
      var counts = { total: obs.length, pending: 0, verified: 0, rejected: 0, archived: 0 };
      obs.forEach(function (o) { counts[o.meta.status] += 1; });
      var audit = reasoner.audit().summary;
      var ev = evaluator.evaluate();
      return {
        heartbeat: { alive: hb.alive, pulse: hb.pulse },
        ocean: os.memory.status(),
        reality: counts,
        soundness: audit,
        evaluation: { score: ev.score, grade: ev.grade, issues: ev.issues },
        log: logger ? logger.status() : null
      };
    }

    /* ---- named health checks ---- */
    function checks() {
      var g = gauges();
      var out = [];
      function add(id, name, verdict, detail) { out.push({ id: id, name: name, verdict: verdict, detail: detail }); }

      add("HB", "heartbeat has beaten",
        g.heartbeat.pulse > 0 ? "pass" : "warn",
        g.heartbeat.pulse > 0 ? "pulse " + g.heartbeat.pulse + (g.heartbeat.alive ? " (live timer running)" : " (manual)") : "the system has never beaten — has it booted?");

      add("STORAGE", "persistence is holding",
        g.ocean.storageErrors === 0 ? "pass" : "fail",
        g.ocean.storageErrors === 0 ? "no storage errors" : g.ocean.storageErrors + " storage write(s) failed — records survive in memory only");

      var unsoundish = g.soundness.unsound + g.soundness.broken;
      add("SOUND", "nothing rests on rejected or missing ground",
        unsoundish === 0 ? "pass" : "fail",
        unsoundish === 0 ? "all grounded records sound or provisional" : unsoundish + " record(s) unsound/broken — run the Planner (0029) for the fix list");

      add("PENDING", "verification backlog is under control",
        g.reality.pending <= pendingBacklog ? "pass" : "warn",
        g.reality.pending + " observation(s) awaiting a verdict (threshold " + pendingBacklog + ")");

      if (!logger) add("LOG", "the system is being observed", "warn", "no logger attached — an unobserved system is a risk");
      else add("LOG", "no operational errors logged",
        g.log.counts.error === 0 ? "pass" : "fail",
        g.log.counts.error === 0 ? g.log.emitted + " entries, none at error level" : g.log.counts.error + " error(s) in the operational log");

      add("SCORE", "self-evaluation meets the bar",
        g.evaluation.score >= minScore ? "pass" : "fail",
        "grade " + g.evaluation.grade + " (" + g.evaluation.score + "/100, bar " + minScore + ")");

      return out;
    }

    function healthy() {
      return checks().every(function (c) { return c.verdict !== "fail"; });
    }

    /* ---- the release gate (the seed of CI/CD) ---- */
    function releaseGate() {
      var cs = checks();
      var blockers = cs.filter(function (c) { return c.verdict === "fail"; });
      var cautions = cs.filter(function (c) { return c.verdict === "warn"; });
      var release = blockers.length === 0;
      return {
        release: release,
        blockers: blockers,
        cautions: cautions,
        headline: release
          ? "RELEASE PERMITTED — " + (cs.length - cautions.length) + "/" + cs.length + " checks pass" +
            (cautions.length ? ", " + cautions.length + " caution(s)" : "")
          : "RELEASE BLOCKED — " + blockers.map(function (c) { return c.id; }).join(", ") + " failing"
      };
    }

    /* ---- one observed sample, into the operational log ---- */
    function sample() {
      var g = gauges();
      var gate = releaseGate();
      var snap = { at: null, healthy: gate.release, gate: gate, gauges: g };
      if (logger) {
        var entry = logger[gate.release ? "info" : "error"](
          "health: " + gate.headline,
          { healthy: gate.release, score: g.evaluation.score, pulse: g.heartbeat.pulse }
        );
        if (entry) snap.at = entry.at;
      }
      return snap;
    }

    return { gauges: gauges, checks: checks, healthy: healthy, releaseGate: releaseGate, sample: sample };
  }

  return createMonitor;
});
