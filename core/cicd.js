/*
 * Ω∞ OceanicOS :: CI/CD
 * Build 0048 · Stage 6 (Infrastructure) · zero-runtime (plain browser or any JS engine)
 *
 * The doctrine's "Test. Record. Release." as one runnable capability. A release
 * is not a copy of files — it is a CLAIM: "this system was verified and healthy
 * at this version." CI/CD makes that claim honestly by composing what exists:
 *
 *   Automation (0016)  — the pipeline that halts on first failure
 *   Verification       — an injected verify() (in production: Continuous
 *                        Verification 0013's aggregate verdict)
 *   Monitoring (0047)  — releaseGate(): healthy enough to release?
 *   Versioning (0015)  — semver bump for the new version
 *   Memory (0005)      — the release ledger, append-only, type:"release"
 *
 * release({ level, notes }) runs:  verify → gate → version → record
 * and REFUSES to ship on any failure — a failed verification or a blocked
 * gate halts the pipeline and nothing is recorded. There is no rollback and
 * no delete: a bad release is YANKED by open amendment (visible forever) and
 * followed by a better release. History is the changelog.
 *
 *   release(opts) · current() · history() · yank(version, reason) · status()
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createCICD = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function createCICD(options) {
    options = options || {};
    var os = options.oceanic;
    var memory = options.memory || (os && os.memory);
    if (!memory || typeof memory.remember !== "function" || typeof memory.amend !== "function") {
      throw new TypeError("createCICD requires an OceanicOS or a Memory: createCICD({ oceanic, ... })");
    }
    var monitor = options.monitor;
    if (!monitor || typeof monitor.releaseGate !== "function") {
      throw new TypeError("createCICD requires a Monitor (0047): createCICD({ oceanic, monitor, verify })");
    }
    var verify = options.verify;
    if (typeof verify !== "function") {
      throw new TypeError("createCICD requires a verify function — in production, Continuous Verification's aggregate verdict: createCICD({ oceanic, monitor, verify })");
    }
    var C = (root && root.OceanicCore) || {};
    var pipelineFactory = options.pipelineFactory || C.createPipeline;
    if (typeof pipelineFactory !== "function") throw new Error("createCICD needs Automation — load core/automation.js first, or pass { pipelineFactory }");
    var semver = options.versioning || C.versioning;
    if (!semver || typeof semver.bump !== "function") throw new Error("createCICD needs Versioning — load core/versioning.js first, or pass { versioning }");
    var logger = options.logger || null;
    var initial = options.initial || "1.0.0";
    if (!semver.valid(initial)) throw new TypeError("initial must be valid semver, got " + initial);
    var LEVELS = { major: 1, minor: 1, patch: 1 };

    /* ---- the release ledger (append-only, in the one ocean) ---- */
    function releases() { return memory.recall({ type: "release" }); }
    function shape(r) {
      var m = r.meta;
      return { version: m.version, level: m.level, notes: m.notes, status: m.status,
               reason: m.reason || null, verification: m.verification, gate: m.gate, at: r.at };
    }
    function history() { return releases().map(shape); }
    function recordOf(version) {
      var all = releases();
      for (var i = 0; i < all.length; i++) if (all[i].meta.version === version) return all[i];
      return null;
    }
    function current() {
      var live = releases().filter(function (r) { return r.meta.status === "released"; })
        .map(function (r) { return r.meta.version; });
      if (!live.length) return null;
      return semver.sort(live, true)[0]; // highest non-yanked version
    }

    /* ---- the pipeline: verify → gate → version → record ---- */
    function release(opts) {
      opts = opts || {};
      var level = opts.level || "patch";
      if (!LEVELS[level]) throw new TypeError("release level must be major, minor, or patch");

      var p = pipelineFactory({ name: "release", logger: logger });
      p.step("verify", function (ctx) {
        var v = verify(ctx);
        if (v === true) v = { verdict: "PASS", total: null, passed: null, failed: null };
        if (!v || v.verdict !== "PASS") {
          throw new Error("verification did not pass" + (v && v.failed != null ? " (" + v.failed + " failing)" : "") + " — release forbidden");
        }
        ctx.verification = { total: v.total, passed: v.passed, failed: v.failed };
        return "verified" + (v.total != null ? " (" + v.passed + "/" + v.total + ")" : "");
      });
      p.step("gate", function (ctx) {
        var gate = monitor.releaseGate();
        ctx.gate = gate;
        if (!gate.release) {
          throw new Error(gate.headline + " — blockers: " + gate.blockers.map(function (b) { return b.id; }).join(", "));
        }
        return gate.headline;
      });
      p.step("version", function (ctx) {
        var cur = current();
        ctx.version = cur === null ? initial : semver.bump(cur, level);
        return ctx.version;
      });
      p.step("record", function (ctx) {
        memory.remember({
          type: "release",
          body: "release v" + ctx.version + (opts.notes ? " — " + opts.notes : ""),
          source: "cicd", confidence: "certain",
          meta: {
            version: ctx.version, level: level, notes: opts.notes || null, status: "released",
            verification: ctx.verification, gate: ctx.gate.headline
          }
        });
        return "recorded v" + ctx.version;
      });

      var ctx = {};
      var report = p.run(ctx);
      return {
        ok: report.ok,
        version: report.ok ? ctx.version : null,
        verification: ctx.verification || null,
        gate: ctx.gate || null,
        report: report
      };
    }

    /* ---- yank: a bad release is marked, never erased ---- */
    function yank(version, reason) {
      var rec = recordOf(version);
      if (!rec) throw new Error("no release with version " + version);
      if (rec.meta.status === "yanked") throw new Error("release " + version + " is already yanked");
      if (typeof reason !== "string" || !reason) throw new TypeError("yank requires a reason — a yanked release must say why");
      var amended = memory.amend(rec.id, {
        type: "release", body: rec.body + " [YANKED: " + reason + "]",
        source: "cicd", confidence: "certain",
        meta: {
          version: rec.meta.version, level: rec.meta.level, notes: rec.meta.notes, status: "yanked",
          reason: reason, verification: rec.meta.verification, gate: rec.meta.gate
        }
      });
      if (logger) try { logger.warn("release v" + version + " yanked: " + reason); } catch (e) {}
      return shape(amended);
    }

    function status() {
      var all = history();
      var yanked = all.filter(function (r) { return r.status === "yanked"; }).length;
      return { releases: all.length, yanked: yanked, current: current(), initial: initial };
    }

    return { release: release, current: current, history: history, yank: yank, status: status };
  }

  return createCICD;
});
