/*
 * Ω∞ OceanicOS :: Deployment
 * Build 0049 · Stage 6 (Infrastructure) · zero-runtime (plain browser or any JS engine)
 *
 * A release (0048) is a verified claim; DEPLOYMENT is that claim delivered —
 * the ocean shipped to a named target environment and BOOTED there, proven
 * alive, and recorded. Because the whole system is one Memory snapshot
 * (Kernel 0011: "persist that one Memory and the entire system persists"),
 * deploying is honest and total: write the snapshot to the target's storage,
 * stand up a fresh kernel over it, and check it actually came up.
 *
 *   addTarget(name, storage) — register an environment (any getItem/setItem
 *                              backend: localStorage, a device, a fake shore)
 *   deploy(target)           — snapshot → deliver → boot → record, halting on
 *                              first failure; only a LIVE release may deploy,
 *                              and the deployment is refused (nothing recorded)
 *                              if the target cannot take or boot the snapshot
 *   history() · active(target) · targets() · status()
 *
 * Doctrine: the version labels the claim (the current live release from the
 * CI/CD ledger); the content is the ocean as of this deploy. A failed deploy
 * leaves the ledger untouched — the operational log (0014) holds the failure.
 * There is no undeploy: environments move forward by deploying again.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createDeployment = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function createDeployment(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || !os.memory || typeof os.exportSnapshot !== "function") {
      throw new TypeError("createDeployment requires an assembled OceanicOS: createDeployment({ oceanic, cicd })");
    }
    var cicd = options.cicd;
    if (!cicd || typeof cicd.current !== "function") {
      throw new TypeError("createDeployment requires a CI/CD (0048): createDeployment({ oceanic, cicd })");
    }
    var C = (root && root.OceanicCore) || {};
    var pipelineFactory = options.pipelineFactory || C.createPipeline;
    if (typeof pipelineFactory !== "function") throw new Error("createDeployment needs Automation — load core/automation.js first, or pass { pipelineFactory }");
    var bootFactory = options.oceanicFactory || C.createOceanic;
    if (typeof bootFactory !== "function") throw new Error("createDeployment needs the Kernel factory — load core/oceanic.js first, or pass { oceanicFactory }");
    var logger = options.logger || null;

    var targets = {}; // name -> storage (runtime registry; storages are live objects, not records)

    function addTarget(name, storage) {
      if (typeof name !== "string" || !name) throw new TypeError("addTarget requires a target name");
      if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
        throw new TypeError("addTarget requires a storage backend with getItem/setItem");
      }
      targets[name] = storage;
      return listTargets();
    }
    function listTargets() { return Object.keys(targets).sort(); }

    /* ---- the deployment ledger ---- */
    function deployments() { return os.memory.recall({ type: "deployment" }); }
    function shape(r) {
      var m = r.meta;
      return { target: m.target, version: m.version, records: m.records, status: m.status, at: r.at };
    }
    function history() { return deployments().map(shape); }
    function active(target) {
      var all = deployments().filter(function (r) { return r.meta.target === target; });
      return all.length ? shape(all[all.length - 1]) : null;
    }

    function deploy(target) {
      if (!targets[target]) throw new Error("no target named '" + target + "' — addTarget(name, storage) first");
      var version = cicd.current();
      if (version === null) throw new Error("nothing has been released — a deployment ships a LIVE release (run cicd.release() first)");
      var storage = targets[target];
      var storageKey = "oceanicos." + target;

      var p = pipelineFactory({ name: "deploy:" + target, logger: logger });
      p.step("snapshot", function (ctx) {
        ctx.snapshot = os.exportSnapshot();
        ctx.records = JSON.parse(ctx.snapshot).records.length;
        return ctx.records + " records";
      });
      p.step("deliver", function (ctx) {
        storage.setItem(storageKey, ctx.snapshot); // a throwing target fails the step
        return "written to " + target;
      });
      p.step("boot", function (ctx) {
        var booted = bootFactory({ storage: storage, storageKey: storageKey, manual: true, name: target });
        var beat = booted.start();
        var count = booted.memory.status().count;
        if (count !== ctx.records) {
          throw new Error("the target came up with " + count + " of " + ctx.records + " records — refusing to call that deployed");
        }
        if (!(beat.pulse >= 1)) throw new Error("the target did not beat on boot");
        ctx.booted = { records: count, pulse: beat.pulse };
        return "alive with " + count + " records";
      });
      p.step("record", function (ctx) {
        os.memory.remember({
          type: "deployment",
          body: "deploy v" + version + " → " + target + " (" + ctx.records + " records)",
          source: "deployment", confidence: "certain",
          meta: { target: target, version: version, records: ctx.records, status: "deployed" }
        });
        return "recorded";
      });

      var ctx = {};
      var report = p.run(ctx);
      return {
        ok: report.ok,
        target: target,
        version: report.ok ? version : null,
        booted: ctx.booted || null,
        report: report
      };
    }

    function status() {
      var byTarget = {};
      listTargets().forEach(function (t) {
        var a = active(t);
        byTarget[t] = a ? a.version : null;
      });
      return { deployments: deployments().length, targets: byTarget };
    }

    return { addTarget: addTarget, targets: listTargets, deploy: deploy,
             history: history, active: active, status: status };
  }

  return createDeployment;
});
