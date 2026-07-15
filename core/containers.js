/*
 * Ω∞ OceanicOS :: Containers
 * Build 0050 · Stage 6 (Infrastructure) · zero-runtime (plain browser or any JS engine)
 *
 * The last piece of Infrastructure: ISOLATED, NAMED ENVIRONMENTS with a
 * lifecycle. A container holds its own storage and, when running, its own
 * kernel — a whole OceanicOS in a box. Containers are what "Cloud" means in
 * zero-runtime terms: many isolated oceans, provisioned on demand, deployable
 * (Deployment 0049 targets a container's storage), suspendable without loss,
 * and mergeable across each other (Synchronization 0046).
 *
 *   provision(name)          → an isolated environment (its own storage, no kernel yet)
 *   start(name)              → boot a kernel over the container's ocean   [running]
 *   exec(name, fn)           → run work against a RUNNING container's kernel
 *   suspend(name)            → persist and power down — the ocean stays    [suspended]
 *   start(name)              → resume: rehydrate everything from storage   [running]
 *   decommission(name, why)  → terminal — but the ocean is HANDED BACK as a
 *                              final snapshot, never destroyed; a tombstone
 *                              with the reason remains in the registry
 *   storageOf(name) · get · list · status
 *
 * Lifecycle: provisioned → running ⇄ suspended → decommissioned (terminal).
 * Isolation is real: nothing a container records is visible to any other
 * container or to the host — until Sync deliberately merges oceans.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createContainers = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function memoryStorage() {
    var d = {};
    return { getItem: function (k) { return (k in d) ? d[k] : null; }, setItem: function (k, v) { d[k] = v; } };
  }

  function createContainers(options) {
    options = options || {};
    var C = (root && root.OceanicCore) || {};
    var oceanicFactory = options.oceanicFactory || C.createOceanic;
    if (typeof oceanicFactory !== "function") {
      throw new Error("createContainers needs the Kernel factory — load core/oceanic.js first, or pass { oceanicFactory }");
    }
    var logger = options.logger || null;
    var registry = {}; // name -> { name, state, storage, storageKey, os, reason, records }

    function log(msg) { if (logger) try { logger.info("containers · " + msg); } catch (e) {} }
    function must(name) {
      var c = registry[name];
      if (!c) throw new Error("no container named '" + name + "'");
      return c;
    }
    function live(name, verb) {
      var c = must(name);
      if (c.state === "decommissioned") throw new Error("container '" + name + "' is decommissioned — cannot " + verb + " it");
      return c;
    }
    function shape(c) {
      return { name: c.name, state: c.state, reason: c.reason || null,
               records: c.os ? c.os.memory.status().count : c.records };
    }

    function provision(name, opts) {
      if (typeof name !== "string" || !name) throw new TypeError("provision requires a container name");
      if (registry[name]) throw new Error("a container named '" + name + "' already exists");
      registry[name] = {
        name: name, state: "provisioned",
        storage: (opts && opts.storage) || memoryStorage(),
        storageKey: "oceanicos." + name,
        os: null, reason: null, records: 0
      };
      log("provisioned '" + name + "'");
      return shape(registry[name]);
    }

    function start(name) {
      var c = live(name, "start");
      if (c.state === "running") throw new Error("container '" + name + "' is already running");
      c.os = oceanicFactory({ storage: c.storage, storageKey: c.storageKey, manual: true, name: name });
      var beat = c.os.start();
      c.state = "running";
      log("started '" + name + "' — " + c.os.memory.status().count + " records aboard, pulse " + beat.pulse);
      return { name: name, state: c.state, records: c.os.memory.status().count, pulse: beat.pulse };
    }

    function exec(name, fn) {
      var c = live(name, "exec against");
      if (c.state !== "running") throw new Error("container '" + name + "' is " + c.state + " — start it before exec");
      if (typeof fn !== "function") throw new TypeError("exec requires a function to run against the container's kernel");
      return fn(c.os);
    }

    function suspend(name) {
      var c = live(name, "suspend");
      if (c.state !== "running") throw new Error("container '" + name + "' is " + c.state + " — only a running container suspends");
      c.os.stop();
      c.storage.setItem(c.storageKey, c.os.exportSnapshot()); // the ocean outlives the kernel
      c.records = c.os.memory.status().count;
      c.os = null;
      c.state = "suspended";
      log("suspended '" + name + "' — " + c.records + " records persisted");
      return shape(c);
    }

    function decommission(name, reason) {
      var c = live(name, "decommission");
      if (typeof reason !== "string" || !reason) throw new TypeError("decommission requires a reason — an environment must not vanish silently");
      var snapshot = c.os ? c.os.exportSnapshot()
        : (c.storage.getItem(c.storageKey) || JSON.stringify({ v: 1, records: [] }));
      var records = 0;
      try { records = JSON.parse(snapshot).records.length; } catch (e) {}
      if (c.os) { try { c.os.stop(); } catch (e) {} }
      c.os = null;
      c.state = "decommissioned";
      c.reason = reason;
      c.records = records;
      log("decommissioned '" + name + "' (" + reason + ") — final ocean of " + records + " records handed back");
      return { name: name, state: c.state, reason: reason, records: records, snapshot: snapshot };
    }

    function storageOf(name) { return live(name, "expose the storage of").storage; }
    function get(name) { return registry[name] ? shape(registry[name]) : null; }
    function list() {
      return Object.keys(registry).sort().map(function (n) { return shape(registry[n]); });
    }
    function status() {
      var byState = {};
      list().forEach(function (c) { byState[c.state] = (byState[c.state] || 0) + 1; });
      return { containers: list().length, byState: byState };
    }

    return { provision: provision, start: start, exec: exec, suspend: suspend,
             decommission: decommission, storageOf: storageOf, get: get, list: list, status: status };
  }

  return createContainers;
});
