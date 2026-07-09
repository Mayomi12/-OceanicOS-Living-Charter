/*
 * Ω∞ OceanicOS :: Reasoning
 * Build 0028 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * Search finds; the Graph connects; Reasoning JUDGES. The Charter's rule is
 * "verification before acceptance" — a decision or a piece of knowledge is only
 * as sound as the reality it rests on. But reality moves: an observation that was
 * pending gets verified, or one that was trusted gets rejected. The Reasoner
 * propagates the current status of observations up to everything grounded on
 * them, and tells you what to revisit.
 *
 * Soundness of a grounded record, from the status of its grounds:
 *   sound        — every ground is VERIFIED.
 *   provisional  — no ground is rejected, but some are not yet verified
 *                  (pending or archived).
 *   unsound      — at least one ground has been REJECTED. It rests on reality
 *                  the system has refused; revisit it.
 *   broken       — a cited ground no longer exists (a data-integrity flag).
 *   ungrounded   — it cites no grounds at all (an opinion, not an inference).
 * Concern ranks broken > unsound > provisional > sound.
 *
 * This is pure inference over the current ocean — it changes nothing; it only
 * reports. What you DO about an unsound decision (reverse it) or provisional
 * knowledge (verify its grounds) stays a human/agent act through the engines.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createReasoner = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RANK = { sound: 0, ungrounded: 1, provisional: 2, unsound: 3, broken: 4 };

  function createReasoner(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || !os.reality || !os.decisions || !os.knowledge) {
      throw new TypeError("createReasoner requires an assembled OceanicOS: createReasoner({ oceanic })");
    }

    function idOf(r) { return (r.meta && (r.meta.did || r.meta.kid)) || r.id; }

    // every current grounded record (decisions + knowledge)
    function groundedRecords() {
      return os.decisions.decisions(false).concat(os.knowledge.knowledge(false));
    }
    function find(id) {
      var all = groundedRecords();
      for (var i = 0; i < all.length; i++) if (idOf(all[i]) === id) return all[i];
      return null;
    }

    function statusOfGround(gid) {
      var o = os.reality.get(gid);
      return o ? o.meta.status : "missing";
    }

    function assessRecord(r) {
      var grounds = (r.meta && r.meta.grounds) ? r.meta.grounds.slice() : [];
      var detail = grounds.map(function (g) { return { id: g, status: statusOfGround(g) }; });
      var soundness, reason;
      if (!grounds.length) { soundness = "ungrounded"; reason = "cites no grounds — an opinion, not an inference"; }
      else if (detail.some(function (d) { return d.status === "missing"; })) { soundness = "broken"; reason = "a cited observation no longer exists"; }
      else if (detail.some(function (d) { return d.status === "rejected"; })) { soundness = "unsound"; reason = "rests on an observation that has been REJECTED"; }
      else if (detail.some(function (d) { return d.status !== "verified"; })) { soundness = "provisional"; reason = "some grounds are not yet verified"; }
      else { soundness = "sound"; reason = "every ground is verified"; }
      return {
        id: idOf(r), type: r.type, status: (r.meta && r.meta.status) || null,
        title: r.body, soundness: soundness, reason: reason, grounds: detail
      };
    }

    function assess(id) {
      var r = find(id);
      if (!r) throw new Error("no grounded record (decision or knowledge) with id " + id);
      return assessRecord(r);
    }

    function audit() {
      var items = groundedRecords().map(assessRecord);
      // most-concerning first
      items.sort(function (a, b) { return RANK[b.soundness] - RANK[a.soundness]; });
      var summary = { sound: 0, provisional: 0, unsound: 0, broken: 0, ungrounded: 0 };
      items.forEach(function (it) { summary[it.soundness] += 1; });
      return { items: items, summary: summary, total: items.length };
    }

    // the actionable set: anything resting on rejected or missing reality
    function unsound() {
      return audit().items.filter(function (it) { return it.soundness === "unsound" || it.soundness === "broken"; });
    }

    // what rests on a given observation (and how sound each is now)
    function dependents(oid) {
      return groundedRecords()
        .filter(function (r) { return r.meta && Array.isArray(r.meta.grounds) && r.meta.grounds.indexOf(oid) >= 0; })
        .map(assessRecord);
    }

    function explain(id) {
      var a = assess(id);
      var gs = a.grounds.map(function (g) { return g.id + " [" + g.status + "]"; }).join(", ") || "none";
      return a.type + " " + a.id + " is " + a.soundness.toUpperCase() + " — " + a.reason + ". Grounds: " + gs + ".";
    }

    return { assess: assess, audit: audit, unsound: unsound, dependents: dependents, explain: explain };
  }

  createReasoner.RANK = RANK;
  return createReasoner;
});
