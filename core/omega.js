/*
 * Ω∞ OceanicOS :: Omega — the Full-Stack Assembly
 * Build 0069 · Ω∞v · zero-runtime (plain browser)
 *
 * Fifty-eight capabilities exist as verified parts; Omega is the whole ship
 * assembled: ONE Memory Ocean with every layer standing on it —
 *
 *   Kernel (0011)            reality · decisions · knowledge · projects · builds
 *   Identity (0035)          who acts, with a live session
 *   Permissions (0036)       the API gated by the actor at the helm
 *   Governance (0043)        propose → review → ratify, quorum-gated
 *   Logger (0014) + Monitor (0047)   the operational record and the health gate
 *   Maintenance (0061)       the standing chore list
 *   Continuous Improvement (0062)    the loop that proposes; humans decide
 *   Search (0026) · Privacy (0057) · Preservation (0059)
 *
 * createOmega({ storage?, name?, now?, quorum? }) boots it all and returns the
 * layers PLUS one honest instrument panel:
 *
 *   dashboard()  → a single, pure snapshot of the whole ship: who is at the
 *                  helm, the ocean, reality's counts, the grade, the gate,
 *                  the chores, governance, and the improvement practice
 *
 * Laws that hold across the assembly (and are verified to): every layer reads
 * and writes the SAME ocean; an anonymous caller cannot write; verdicts need a
 * steward; the improvement loop ends at the human gate; hand Omega a storage
 * and the entire ship survives a reboot.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createOmega = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "Ω∞v";

  function createOmega(options) {
    options = options || {};
    var C = options.core || (root && root.OceanicCore) || {};
    ["createOceanic", "createIdentity", "createPermissions", "createGovernance", "createLogger",
     "createMonitor", "createMaintenance", "createImprovement", "createSearch", "createPrivacy",
     "createPreservation", "createAPI"].forEach(function (f) {
      if (typeof C[f] !== "function") throw new Error("createOmega needs " + f + " — load the core modules first (see core/omega.html for the full manifest)");
    });

    var oceanic = C.createOceanic({ storage: options.storage || null, storageKey: options.storageKey,
                                    name: options.name || "omega", now: options.now, manual: true });
    oceanic.start();

    var logger = C.createLogger({ now: options.now });
    var identity = C.createIdentity({ oceanic: oceanic });
    var permissions = C.createPermissions({ identity: identity, anonymous: null }); // no identity, no writes
    var api = permissions.wrap(C.createAPI({ oceanic: oceanic }));
    var governance = C.createGovernance({ oceanic: oceanic, identity: identity,
                                          quorum: typeof options.quorum === "number" ? options.quorum : 1 });
    var monitor = C.createMonitor({ oceanic: oceanic, logger: logger });
    var maintenance = C.createMaintenance({ oceanic: oceanic, logger: logger, now: options.now });
    var improve = C.createImprovement({ oceanic: oceanic, governance: governance, monitor: monitor });
    var search = C.createSearch({ oceanic: oceanic });
    var privacy = C.createPrivacy({ oceanic: oceanic, logger: logger });
    var preservation = C.createPreservation({ now: options.now });

    function dashboard() {
      var g = monitor.gauges();
      return {
        version: VERSION,
        helm: identity.current(),                        // who is acting, or null
        ocean: oceanic.memory.status(),                  // the one ocean
        reality: g.reality,                              // pending / verified / rejected / archived
        evaluation: g.evaluation,                        // score · grade · issues
        gate: monitor.releaseGate().headline,            // healthy enough to release?
        chores: maintenance.status(),                    // what upkeep stands
        governance: governance.status(),                 // proposals, pending, quorum
        improvement: improve.status(),                   // the practice so far
        actors: identity.status()                        // the register
      };
    }

    function seal(label) { return preservation.seal(oceanic.memory, { label: label || "omega" }); }

    return {
      version: VERSION,
      oceanic: oceanic, identity: identity, permissions: permissions, api: api,
      governance: governance, logger: logger, monitor: monitor, maintenance: maintenance,
      improve: improve, search: search, privacy: privacy, preservation: preservation,
      dashboard: dashboard, seal: seal
    };
  }

  createOmega.VERSION = VERSION;
  return createOmega;
});
