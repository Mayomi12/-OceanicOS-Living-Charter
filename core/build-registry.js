/*
 * Ω∞ OceanicOS Core :: Build Registry
 * Build 0006 · Stage 1 · zero-runtime (plain browser or any JS engine)
 *
 * The doctrine's own ledger as a capability: every build is recorded with its
 * stage, capability, verification method, and release reference.
 *
 * Composition, not reinvention: the Registry stores everything in a Core
 * Memory (build 0005), inheriting its invariants for free — append-only,
 * open supersession, provenance, optional persistence. The Registry adds the
 * doctrine's discipline on top:
 *  - ONE AT A TIME: build numbers are strictly sequential. No skipping ahead,
 *    no duplicates — the Final Law, enforced.
 *  - EVERY BUILD VERIFIED: a build cannot be recorded without stating how it
 *    was verified and what released it.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createBuildRegistry = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createBuildRegistry(options) {
    options = options || {};
    var memory = options.memory;
    if (!memory || typeof memory.remember !== "function" || typeof memory.recall !== "function") {
      throw new TypeError("createBuildRegistry requires a Core Memory instance: createBuildRegistry({ memory })");
    }
    var firstNumber = (typeof options.firstNumber === "number") ? options.firstNumber : 1;

    function builds(includeSuperseded) {
      return memory.recall({ type: "build", includeSuperseded: !!includeSuperseded });
    }

    function latest() {
      // highest build number among current records — an amendment to an old
      // build is appended last in the timeline but is NOT the latest build
      var all = builds(false);
      var best = null;
      for (var i = 0; i < all.length; i++) {
        if (!best || all[i].meta.number > best.meta.number) best = all[i];
      }
      return best;
    }

    function next() {
      // next number continues from the highest ever recorded (amendments do
      // not reuse numbers; history only moves forward)
      var all = builds(true);
      var max = firstNumber - 1;
      for (var i = 0; i < all.length; i++) {
        if (all[i].meta.number > max) max = all[i].meta.number;
      }
      return max + 1;
    }

    function validate(build) {
      if (!build || typeof build !== "object") throw new TypeError("record requires a build object");
      if (typeof build.number !== "number" || build.number % 1 !== 0) throw new TypeError("build.number must be an integer");
      if (typeof build.stage !== "number" || build.stage < 0 || build.stage > 8) throw new TypeError("build.stage must be 0–8");
      if (typeof build.capability !== "string" || !build.capability) throw new TypeError("build.capability is required — name the ONE thing built");
      if (typeof build.verification !== "string" || !build.verification) throw new TypeError("build.verification is required — an unverified build cannot be recorded");
      if (typeof build.release !== "string" || !build.release) throw new TypeError("build.release is required — commit, tag, or artifact reference");
    }

    function record(build) {
      validate(build);
      var expected = next();
      if (build.number !== expected) {
        throw new Error("record: expected build " + expected + ", got " + build.number +
          " — one capability at a time, no skipping, no duplicates");
      }
      return memory.remember({
        type: "build",
        body: "build " + build.number + " — " + build.capability,
        source: build.release,
        confidence: build.confidence || "high",
        meta: {
          number: build.number,
          stage: build.stage,
          capability: build.capability,
          verification: build.verification,
          release: build.release
        }
      });
    }

    function amend(number, correction) {
      var all = builds(false);
      var target = null;
      for (var i = 0; i < all.length; i++) {
        if (all[i].meta.number === number) { target = all[i]; break; }
      }
      if (!target) throw new Error("amend: no current build record numbered " + number);
      var m = target.meta;
      var fixed = {
        number: m.number,
        stage: (typeof correction.stage === "number") ? correction.stage : m.stage,
        capability: correction.capability || m.capability,
        verification: correction.verification || m.verification,
        release: correction.release || m.release
      };
      validate(fixed);
      return memory.amend(target.id, {
        type: "build",
        body: "build " + fixed.number + " — " + fixed.capability,
        source: fixed.release,
        confidence: correction.confidence || target.confidence,
        meta: fixed
      });
    }

    function history() {
      return builds(false).sort(function (a, b) { return a.meta.number - b.meta.number; });
    }

    function byStage(stage) {
      return builds(false).filter(function (b) { return b.meta.stage === stage; });
    }

    function status() {
      var all = builds(false);
      var perStage = {};
      for (var i = 0; i < all.length; i++) {
        var s = all[i].meta.stage;
        perStage[s] = (perStage[s] || 0) + 1;
      }
      var last = latest();
      return {
        builds: all.length,
        latestNumber: last ? last.meta.number : null,
        latestCapability: last ? last.meta.capability : null,
        nextNumber: next(),
        perStage: perStage
      };
    }

    // Deliberately absent, as in Memory: no delete, no rewrite of the ledger.
    return { record: record, amend: amend, latest: latest, next: next,
             history: history, byStage: byStage, status: status };
  }

  return createBuildRegistry;
});
