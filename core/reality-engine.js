/*
 * Ω∞ OceanicOS Core :: Reality Engine
 * Build 0007 · Stage 1 · zero-runtime (plain browser or any JS engine)
 *
 * "Reality before assumptions. Verification before acceptance." The Reality
 * Engine is where the world enters OceanicOS: it stores observations and moves
 * each one through the verification states the Charter names —
 *   PENDING → VERIFIED | REJECTED | ARCHIVED.
 *
 * Composition, not reinvention: like the Build Registry (0006), the Reality
 * Engine stores everything in a Core Memory (0005), inheriting its invariants
 * for free — append-only, provenance, optional persistence. Crucially, a status
 * change is NOT a rewrite: it is a Memory amend(), so the whole life of an
 * observation (observed → verified, or verified → archived) stays visible.
 * How reality was re-understood is itself remembered.
 *
 * Every observation carries the Charter's fields:
 *   Observation (the claim) · Source · Evidence · Timestamp · Confidence · Status.
 *
 * The status machine, enforced in code:
 *  - Birth state is always PENDING — nothing arrives pre-verified.
 *  - A status may never return to PENDING (there is no un-observing).
 *  - ARCHIVED is terminal — an archived observation is closed.
 *  - A no-op transition (to the state it already holds) is refused honestly.
 * Those four rules alone yield exactly the legal transitions:
 *   pending → verified | rejected | archived
 *   verified → rejected | archived        rejected → verified | archived
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createRealityEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var STATUS = ["pending", "verified", "rejected", "archived"];

  function createRealityEngine(options) {
    options = options || {};
    var memory = options.memory;
    if (!memory || typeof memory.remember !== "function" || typeof memory.amend !== "function" || typeof memory.recall !== "function") {
      throw new TypeError("createRealityEngine requires a Core Memory instance: createRealityEngine({ memory })");
    }
    var oseq = 0;
    var oidgen = options.oidgen || function () {
      oseq += 1;
      return "o-" + oseq + "-" + Math.random().toString(16).slice(2, 8);
    };

    /* ---- reads ---- */
    function observations(includeSuperseded) {
      return memory.recall({ type: "observation", includeSuperseded: !!includeSuperseded });
    }

    // the current record for a logical observation (identified by its stable oid)
    function current(oid) {
      var all = observations(false);
      for (var i = 0; i < all.length; i++) {
        if (all[i].meta && all[i].meta.oid === oid) return all[i];
      }
      return null;
    }

    function get(oid) { return current(oid); }

    function byStatus(status) {
      if (STATUS.indexOf(status) < 0) throw new TypeError("unknown status: " + status);
      return observations(false).filter(function (r) { return r.meta.status === status; });
    }

    // the full status journey of one observation, oldest first — every state it
    // has ever held, superseded records included. Reality's audit trail.
    function history(oid) {
      return observations(true)
        .filter(function (r) { return r.meta && r.meta.oid === oid; })
        .sort(function (a, b) { return a.at - b.at; });
    }

    /* ---- writes ---- */
    function observe(entry) {
      if (!entry || typeof entry.observation !== "string" || !entry.observation) {
        throw new TypeError("observe requires an entry with a non-empty string observation (the claim)");
      }
      var oid = oidgen();
      return memory.remember({
        type: "observation",
        body: entry.observation,
        source: entry.source || null,
        confidence: entry.confidence || "medium",
        meta: {
          oid: oid,
          status: "pending",
          evidence: entry.evidence || null,
          note: null
        }
      });
    }

    function setStatus(oid, to, note) {
      if (STATUS.indexOf(to) < 0) throw new TypeError("unknown status: " + to);
      if (to === "pending") throw new Error("cannot set status back to pending — an observation is never un-observed");
      var rec = current(oid);
      if (!rec) throw new Error("no observation with oid " + oid);
      var from = rec.meta.status;
      if (from === "archived") throw new Error("observation " + oid + " is archived — archived observations are closed");
      if (from === to) throw new Error("observation " + oid + " is already " + to);
      return memory.amend(rec.id, {
        type: "observation",
        body: rec.body,
        source: rec.source,
        confidence: rec.confidence,
        meta: {
          oid: oid,
          status: to,
          evidence: rec.meta.evidence,
          note: note || null
        }
      });
    }

    function verify(oid, note) { return setStatus(oid, "verified", note); }
    function reject(oid, note) { return setStatus(oid, "rejected", note); }
    function archive(oid, note) { return setStatus(oid, "archived", note); }

    function status() {
      var all = observations(false);
      var counts = { pending: 0, verified: 0, rejected: 0, archived: 0 };
      for (var i = 0; i < all.length; i++) counts[all[i].meta.status] += 1;
      return {
        total: all.length,
        pending: counts.pending,
        verified: counts.verified,
        rejected: counts.rejected,
        archived: counts.archived
      };
    }

    // Deliberately absent, as throughout Core: no delete, no rewrite. Reality is
    // only ever appended to.
    return {
      observe: observe, verify: verify, reject: reject, archive: archive,
      setStatus: setStatus, get: get, byStatus: byStatus,
      observations: observations, history: history, status: status
    };
  }

  createRealityEngine.STATUS = STATUS.slice();
  return createRealityEngine;
});
