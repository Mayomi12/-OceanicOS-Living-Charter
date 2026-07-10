/*
 * Ω∞ OceanicOS :: Compatibility
 * Build 0045 · Stage 0 (Foundation — Standards) · zero-runtime (plain browser or any JS engine)
 *
 * The Living Agnostic Charter says an implementation may identify as
 * "OceanicOS Compatible" when it follows the Charter, implements the published
 * standards, and PASSES COMPATIBILITY TESTS. SPECIFICATION.md publishes the
 * standards; this module is the tests — executable, so compatibility is a
 * verdict, not a claim.
 *
 * A candidate hands over zero-argument FACTORIES (so every check runs on a
 * fresh, clean instance — the checker writes nothing to any real ocean):
 *
 *   check({ createMemory, createOceanic, verification, level })
 *     → [{ id:"MEM-1", level:1, requirement, verdict:"PASS"|"FAIL", detail }]
 *   report(candidate)
 *     → { compatible, claimed, achieved, passed, failed, checks }
 *   requirements()
 *     → the published requirement list (the same source SPECIFICATION.md cites)
 *
 * Compatibility levels (cumulative):
 *   1 — Memory-compatible   MEM-1..3  record shape · no destruction · open supersession
 *   2 — Kernel-compatible   KRN-1..3  status machine · verification-before-acceptance · history
 *   3 — Fully compatible    VER-1     the uniform verification beacon protocol
 *
 * The checker probes behavior, not identity: any implementation in any language
 * that meets the contract passes — that is the agnosticism the Charter asks for.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createCompatibility = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DESTRUCTIVE = ["delete", "forget", "clear", "remove", "erase", "purge", "drop"];

  var REQUIREMENTS = [
    { id: "MEM-1", level: 1, requirement: "Records round-trip with provenance: remember() → recall() preserves type, body, source, confidence and meta" },
    { id: "MEM-2", level: 1, requirement: "No destructive operation exists on Memory (" + DESTRUCTIVE.join("/") + ")" },
    { id: "MEM-3", level: 1, requirement: "Corrections are open supersession: amend() removes the old record from current recall but the old record remains retrievable" },
    { id: "KRN-1", level: 2, requirement: "Observation status machine enforced: observations start pending, can be verified and archived, and archived is terminal" },
    { id: "KRN-2", level: 2, requirement: "Verification before acceptance: a decision cannot commit on a ground that is not verified" },
    { id: "KRN-3", level: 2, requirement: "Status transitions are preserved as history — the pre-transition record remains in the ocean" },
    { id: "VER-1", level: 3, requirement: "The implementation ships a self-verifying suite speaking the uniform beacon protocol (postMessage oceanicVerify + ✅/❌ title)" }
  ];

  function createCompatibility() {

    /* ---- individual probes: each returns a detail string on failure, null on pass ---- */

    function probeMem1(mem) {
      var r = mem.remember({ type: "observation", body: "compat round-trip", source: "compat", confidence: "high", meta: { probe: 1 } });
      if (!r || !r.id) return "remember() did not return a record with an id";
      var got = mem.recall({ type: "observation" });
      if (got.length !== 1) return "recall({type}) returned " + got.length + " records, expected 1";
      var g = got[0];
      if (g.body !== "compat round-trip") return "body not preserved";
      if (g.type !== "observation") return "type not preserved";
      if (g.source !== "compat") return "source (provenance) not preserved";
      if (g.confidence !== "high") return "confidence not preserved";
      if (!g.meta || g.meta.probe !== 1) return "meta not preserved";
      return null;
    }

    function probeMem2(mem) {
      for (var i = 0; i < DESTRUCTIVE.length; i++) {
        if (typeof mem[DESTRUCTIVE[i]] === "function") return "a destructive operation exists: " + DESTRUCTIVE[i] + "()";
      }
      return null;
    }

    function probeMem3(mem) {
      var r1 = mem.remember({ type: "observation", body: "first understanding", source: "compat", confidence: "medium" });
      var r2 = mem.amend(r1.id, { type: "observation", body: "better understanding", source: "compat", confidence: "high" });
      if (!r2 || r2.id === r1.id) return "amend() did not append a new record (it must supersede, not rewrite)";
      var current = mem.recall({ type: "observation" });
      if (current.length !== 1 || current[0].body !== "better understanding") return "current recall does not show exactly the superseding record";
      // the old record must remain retrievable by SOME sanctioned path
      var oldFound = false;
      if (typeof mem.get === "function") { var o = mem.get(r1.id); oldFound = !!(o && o.body === "first understanding"); }
      if (!oldFound && typeof mem.timeline === "function") {
        oldFound = mem.timeline().some(function (r) { return r.id === r1.id; });
      }
      if (!oldFound) {
        oldFound = mem.recall({ type: "observation", includeSuperseded: true }).some(function (r) { return r.id === r1.id; });
      }
      if (!oldFound) return "the superseded record is no longer retrievable — history was erased";
      return null;
    }

    function probeKrn1(os) {
      var o = os.reality.observe({ observation: "compat: a fresh observation" });
      var oid = o.meta.oid;
      if (o.meta.status !== "pending") return "a fresh observation must start pending (got " + o.meta.status + ")";
      var v = os.reality.verify(oid);
      if (v.meta.status !== "verified") return "verify() must move pending → verified (got " + v.meta.status + ")";
      var a = os.reality.archive(oid);
      if (a.meta.status !== "archived") return "archive() must move verified → archived (got " + a.meta.status + ")";
      try { os.reality.verify(oid); return "archived must be terminal — verify() after archive was allowed"; }
      catch (e) { /* refusal is the requirement */ }
      return null;
    }

    function probeKrn2(os) {
      var o = os.reality.observe({ observation: "compat: an UNVERIFIED ground" });
      var d = os.decisions.propose({ question: "act on it?", options: ["yes", "no"], grounds: [o.meta.oid] });
      try {
        os.decisions.decide(d.meta.did, "yes");
        return "decide() committed on an unverified ground — verification before acceptance is broken";
      } catch (e) { /* refusal is the requirement */ }
      os.reality.verify(o.meta.oid);
      var done = os.decisions.decide(d.meta.did, "yes");
      if (!done || done.meta.status !== "decided") return "decide() failed even after the ground was verified";
      return null;
    }

    function probeKrn3(os) {
      if (!os.memory || typeof os.memory.recall !== "function") return "the kernel does not expose its memory — history cannot be audited";
      var o = os.reality.observe({ observation: "compat: history check" });
      os.reality.verify(o.meta.oid);
      var current = os.memory.recall({ type: "observation" }).length;
      var all = os.memory.recall({ type: "observation", includeSuperseded: true }).length;
      if (!(all > current)) return "a status transition left no history — the pre-transition record is gone";
      return null;
    }

    function probeVer1(candidate) {
      var v = candidate.verification;
      if (!v || v.beacon !== true) return "no verification beacon declared ({ verification: { beacon: true, suite } })";
      if (typeof v.suite !== "string" || !v.suite) return "the verification declaration must name its suite";
      return null;
    }

    /* ---- assembling the run ---- */

    function memoryFactoryOf(candidate) {
      if (typeof candidate.createMemory === "function") return candidate.createMemory;
      if (typeof candidate.createOceanic === "function") {
        return function () { return candidate.createOceanic().memory; };
      }
      return null;
    }

    function run(id, level, fn, subject, missing) {
      var req = null;
      for (var i = 0; i < REQUIREMENTS.length; i++) if (REQUIREMENTS[i].id === id) req = REQUIREMENTS[i];
      var result = { id: id, level: level, requirement: req.requirement, verdict: "FAIL", detail: null };
      if (!subject && id !== "VER-1") { result.detail = missing; return result; }
      try {
        var detail = fn(typeof subject === "function" ? subject() : subject);
        if (detail === null) { result.verdict = "PASS"; }
        else result.detail = detail;
      } catch (e) {
        result.detail = "the probe itself failed: " + (e && e.message ? e.message : String(e));
      }
      return result;
    }

    function check(candidate) {
      if (!candidate || typeof candidate !== "object") throw new TypeError("check requires a candidate: check({ createMemory, createOceanic, verification, level })");
      var memF = memoryFactoryOf(candidate);
      var osF = typeof candidate.createOceanic === "function" ? candidate.createOceanic : null;
      var noMem = "no createMemory (or createOceanic) factory provided";
      var noOs = "no createOceanic factory provided";
      return [
        run("MEM-1", 1, probeMem1, memF, noMem),
        run("MEM-2", 1, probeMem2, memF, noMem),
        run("MEM-3", 1, probeMem3, memF, noMem),
        run("KRN-1", 2, probeKrn1, osF, noOs),
        run("KRN-2", 2, probeKrn2, osF, noOs),
        run("KRN-3", 2, probeKrn3, osF, noOs),
        run("VER-1", 3, probeVer1, candidate, null)
      ];
    }

    function report(candidate) {
      var claimed = candidate && typeof candidate.level === "number" ? candidate.level : 1;
      if (claimed < 1 || claimed > 3) throw new TypeError("a compatibility claim must be level 1, 2 or 3");
      var checks = check(candidate);
      function levelPasses(l) {
        return checks.every(function (c) { return c.level > l || c.verdict === "PASS"; });
      }
      var achieved = 0;
      for (var l = 1; l <= 3; l++) { if (levelPasses(l)) achieved = l; else break; }
      var passed = checks.filter(function (c) { return c.verdict === "PASS"; }).length;
      return {
        compatible: achieved >= claimed,
        claimed: claimed,
        achieved: achieved,
        passed: passed,
        failed: checks.length - passed,
        checks: checks
      };
    }

    function requirements() {
      return REQUIREMENTS.map(function (r) { return { id: r.id, level: r.level, requirement: r.requirement }; });
    }

    return { check: check, report: report, requirements: requirements };
  }

  createCompatibility.LEVELS = { 1: "Memory-compatible", 2: "Kernel-compatible", 3: "Fully compatible" };
  return createCompatibility;
});
