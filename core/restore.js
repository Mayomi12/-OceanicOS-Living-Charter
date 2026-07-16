/*
 * Ω∞ OceanicOS :: Restore (honest revert)
 * Build 0080 · Stage 8 (Stewardship) · zero-runtime (plain browser or any JS engine)
 *
 * Undo, the append-only way. The Charter forbids erasing history (Article III):
 * a mistake is never deleted. So Restore does not remove the wrong version — it
 * APPENDS a new correction that restores an earlier reading. The mistake stays
 * on the record, the restore is itself a recorded, superseding correction, and
 * the whole story remains legible to Provenance (0075) and Retrospect (0076).
 *
 * It stands ON those two lenses and on Memory's amend (0005): it reinvents no
 * lineage-walking of its own. Restore is the one place here that WRITES — and
 * it writes only corrections, never deletions.
 *
 *   createRestore({ memory, provenance, retrospect })
 *   undo(id)          → append a correction restoring the version just before
 *                       the lineage's current tip
 *   revertTo(id, t)   → append a correction restoring what the lineage read
 *                       as of time t
 *   preview(id, t)    → what revertTo WOULD restore, writing nothing
 *
 * Every write returns { ok, record?, restoredFrom?, supersededTip?, reason? }.
 * A no-op (already reads the target; nothing before the origin; not-yet-begun)
 * is refused with ok:false and a reason — it does not append an empty change.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createRestore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createRestore(options) {
    options = options || {};
    var memory = options.memory, provenance = options.provenance, retrospect = options.retrospect;
    if (!memory || typeof memory.amend !== "function" || typeof memory.get !== "function") {
      throw new TypeError("createRestore needs { memory } — a Memory (build 0005) with amend() and get()");
    }
    if (!provenance || typeof provenance.currentOf !== "function" || typeof provenance.trail !== "function") {
      throw new TypeError("createRestore needs { provenance } — a Provenance lens (build 0075)");
    }
    if (!retrospect || typeof retrospect.stateOf !== "function") {
      throw new TypeError("createRestore needs { retrospect } — a Retrospect lens (build 0076)");
    }

    // append a correction to the lineage's current tip that restores `target`'s content
    function restore(id, target, meta) {
      var cur = provenance.currentOf(id);
      if (!cur) return { ok: false, reason: "no record with id " + id + " is in this ocean" };
      if (target.id === cur.id) return { ok: false, reason: "the current version already reads this — nothing to restore", supersededTip: cur.id };
      var rec = memory.amend(cur.id, {
        body: target.body,
        type: cur.type,
        source: "restore",
        confidence: target.confidence,
        meta: meta
      });
      return { ok: true, record: rec, restoredFrom: target.id, supersededTip: cur.id };
    }

    function undo(id) {
      var cur = provenance.currentOf(id);
      if (!cur) return { ok: false, reason: "no record with id " + id + " is in this ocean" };
      var trail = provenance.trail(cur.id);
      var prior = trail.ancestry[0];   // the version the current tip corrected, if any
      if (!prior) return { ok: false, reason: "nothing to undo — this lineage has only its origin", supersededTip: cur.id };
      return restore(id, prior, { restore: "undo", restoredFrom: prior.id });
    }

    function preview(id, t) {
      if (typeof t !== "number" || t !== t) throw new TypeError("preview requires a numeric timestamp");
      var cur = provenance.currentOf(id);
      if (!cur) return { ok: false, reason: "no record with id " + id + " is in this ocean" };
      var past = retrospect.stateOf(id, t);
      if (!past) return { ok: false, reason: "the lineage had not begun as of t=" + t + " — nothing to restore" };
      return { ok: true, currentId: cur.id, current: cur.body, wouldRestoreId: past.id, wouldRestore: past.body,
               noop: past.id === cur.id };
    }

    function revertTo(id, t) {
      if (typeof t !== "number" || t !== t) throw new TypeError("revertTo requires a numeric timestamp");
      var cur = provenance.currentOf(id);
      if (!cur) return { ok: false, reason: "no record with id " + id + " is in this ocean" };
      var past = retrospect.stateOf(id, t);
      if (!past) return { ok: false, reason: "the lineage had not begun as of t=" + t + " — nothing to restore" };
      return restore(id, past, { restore: "revertTo", asOf: t, restoredFrom: past.id });
    }

    return { undo: undo, revertTo: revertTo, preview: preview };
  }

  return createRestore;
});
