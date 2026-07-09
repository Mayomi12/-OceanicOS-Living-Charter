/*
 * Ω∞ OceanicOS Core :: Automation
 * Build 0016 · Stage 2 (Builder) · zero-runtime (plain browser or any JS engine)
 *
 * The build loop as a runnable thing. The doctrine's loop — Observe · Verify ·
 * Design · Build · Test · Record · Release · Learn — is a sequence of steps that
 * must stop the moment one of them fails. Automation is a small, deterministic
 * pipeline runner that models exactly that: named steps that share a context,
 * run in order, and halt on the first failure so nothing downstream proceeds on
 * a broken foundation.
 *
 * Composes on the Logger (0014): if given a logger it records each step's
 * outcome (info on success, error on failure, warn on the steps it had to skip),
 * so a run leaves evidence — as every build must.
 *
 * A step FAILS if it throws OR explicitly returns boolean false; any other
 * return value is a success and is recorded. run() itself NEVER throws: a
 * step's error is caught and becomes part of an immutable, deep-frozen report.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createPipeline = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
    }
    return obj;
  }

  function createPipeline(options) {
    options = options || {};
    var name = options.name || "pipeline";
    var now = options.now || function () { return Date.now(); };
    var logger = options.logger || null;
    if (logger && typeof logger.info !== "function") throw new TypeError("createPipeline: logger, if provided, must be a Logger (needs info/warn/error)");
    var stopOnError = options.stopOnError !== false; // default true — halt the loop on first failure

    var steps = [];

    function step(stepName, fn) {
      if (typeof stepName !== "string" || !stepName) throw new TypeError("step requires a name string");
      if (typeof fn !== "function") throw new TypeError("step '" + stepName + "' requires a function");
      steps.push({ name: stepName, fn: fn });
      return api; // chainable
    }

    function log(level, message, meta) { if (logger) try { logger[level](message, meta); } catch (e) {} }

    function run(context) {
      var ctx = context || {};
      var startedAt = now();
      var results = [];
      var passed = 0, failed = 0, skipped = 0, halted = false;

      for (var i = 0; i < steps.length; i++) {
        var s = steps[i];
        if (halted) {
          results.push({ name: s.name, status: "skipped", value: null, error: null, at: now() });
          skipped += 1;
          log("warn", name + " · skipped step '" + s.name + "' (a prior step failed)");
          continue;
        }
        var entry = { name: s.name, status: "ok", value: null, error: null, at: null };
        try {
          var value = s.fn(ctx);
          if (value === false) { // explicit failure signal
            entry.status = "failed";
            entry.error = "step returned false";
          } else {
            entry.value = (value === undefined) ? null : value;
          }
        } catch (e) {
          entry.status = "failed";
          entry.error = String(e && e.message ? e.message : e);
        }
        entry.at = now();
        results.push(entry);
        if (entry.status === "ok") { passed += 1; log("info", name + " · " + s.name + " ✓"); }
        else {
          failed += 1;
          log("error", name + " · " + s.name + " ✗ — " + entry.error);
          if (stopOnError) halted = true;
        }
      }

      return deepFreeze({
        name: name,
        ok: failed === 0 && steps.length > 0,
        total: steps.length,
        ran: passed + failed,
        passed: passed,
        failed: failed,
        skipped: skipped,
        halted: halted,
        startedAt: startedAt,
        finishedAt: now(),
        steps: results
      });
    }

    function stepNames() { return steps.map(function (s) { return s.name; }); }

    var api = { step: step, run: run, steps: stepNames, name: name };
    return api;
  }

  return createPipeline;
});
