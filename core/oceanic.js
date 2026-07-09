/*
 * Ω∞ OceanicOS :: Kernel
 * Build 0011 · Stage 2 (Builder) · zero-runtime (plain browser or any JS engine)
 *
 * Stage 1 built eight Core capabilities as separate modules. The Kernel is the
 * first Builder capability: it ASSEMBLES them into one running system. The
 * mission's first line — `oceanic start` — becomes real here: the whole system
 * boots on a single pulse.
 *
 * One Memory Ocean. Every engine writes into a SINGLE shared Core Memory (0005)
 * and reads only its own record type, so observations, decisions, knowledge,
 * projects, and the build ledger all live in one append-only ocean — exactly
 * the Charter's image — with no collisions. Persist that one Memory and the
 * entire system persists.
 *
 * Wired for truth. Decisions (0008) and Knowledge (0009) are constructed
 * grounded on the same Reality (0007), so the Charter's "verification before
 * acceptance" holds across the assembled whole, not just within a part.
 *
 * Dependencies are resolved from the OceanicCore namespace the Core modules
 * populate (in a browser, load the eight Core scripts first). For non-browser
 * embedding, pass them explicitly: createOceanic({ core: { createHeartbeat, ... } }).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createOceanic = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "0.11.0"; // system version = build 0011

  function createOceanic(options) {
    options = options || {};
    var C = options.core || (root && root.OceanicCore) || null;
    if (!C || typeof C.createHeartbeat !== "function") {
      throw new Error("createOceanic: the Core factories are not available — load the Core modules first, or pass createOceanic({ core })");
    }
    var required = ["createHeartbeat", "createMemory", "createRealityEngine", "createDecisionEngine",
                    "createKnowledgeEngine", "createProjectsEngine", "createBuildRegistry"];
    for (var i = 0; i < required.length; i++) {
      if (typeof C[required[i]] !== "function") throw new Error("createOceanic: missing Core factory " + required[i]);
    }

    var now = options.now || function () { return Date.now(); };

    // ---- the single Memory Ocean ----
    var memory = C.createMemory({
      name: options.name || "oceanic",
      now: now,
      storage: options.storage || null,
      storageKey: options.storageKey
    });

    // ---- the pulse ----
    var heartbeat = C.createHeartbeat({ now: now, intervalMs: options.intervalMs });

    // ---- the engines, all sharing the one ocean; decisions & knowledge grounded on reality ----
    var reality   = C.createRealityEngine({ memory: memory });
    var decisions = C.createDecisionEngine({ memory: memory, reality: reality });
    var knowledge = C.createKnowledgeEngine({ memory: memory, reality: reality });
    var projects  = C.createProjectsEngine({ memory: memory, now: now });
    var builds    = C.createBuildRegistry({ memory: memory });

    var bootedAt = null;

    // `oceanic start` — the whole system boots on a pulse. Always emits the boot
    // beat (verifiable everywhere); starts a live timer too unless { manual:true }
    // or the environment has no timer.
    function start() {
      var boot = heartbeat.beat({ source: "oceanic start" });
      if (bootedAt === null) bootedAt = boot.at;
      var timer = false;
      if (!options.manual) {
        try { timer = heartbeat.start(); } catch (e) { timer = false; }
      }
      return { started: true, at: boot.at, pulse: boot.pulse, alive: heartbeat.status().alive, timer: timer };
    }
    function beat(meta) { return heartbeat.beat(meta || { source: "oceanic" }); }
    function stop() { return heartbeat.stop(); }

    function status() {
      var hb = heartbeat.status();
      return {
        version: VERSION,
        booted: bootedAt !== null,
        bootedAt: bootedAt,
        alive: hb.alive,
        pulse: hb.pulse,
        memory: memory.status(),      // the whole ocean
        reality: reality.status(),
        decisions: decisions.status(),
        knowledge: knowledge.status(),
        projects: projects.status(),
        builds: builds.status()
      };
    }

    // the entire system is one Memory snapshot — persist or ship this and the
    // whole OceanicOS comes with it
    function exportSnapshot() { return memory.exportSnapshot(); }

    return {
      version: VERSION,
      memory: memory,
      heartbeat: heartbeat,
      reality: reality,
      decisions: decisions,
      knowledge: knowledge,
      projects: projects,
      builds: builds,
      start: start,
      beat: beat,
      stop: stop,
      status: status,
      exportSnapshot: exportSnapshot
    };
  }

  createOceanic.VERSION = VERSION;
  return createOceanic;
});
