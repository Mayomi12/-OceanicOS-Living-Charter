/*
 * Ω∞ OceanicOS Core :: Decision Engine
 * Build 0008 · Stage 1 · zero-runtime (plain browser or any JS engine)
 *
 * "Verification before acceptance." The Reality Engine (0007) decides what is
 * true; the Decision Engine decides what to DO about it — and it may only rest
 * a committed decision on observations reality has actually VERIFIED.
 *
 * Composition, not reinvention: like Reality (0007) and the Build Registry
 * (0006), decisions are stored in a Core Memory (0005) — append-only,
 * provenance, optional persistence, for free. A Reality Engine may be supplied
 * so the Decision Engine can check its grounds; without one, decisions are
 * ungrounded and say so.
 *
 * A decision carries:
 *   Question · Options · Choice · Grounds (observation ids) · Rationale ·
 *   Source · Confidence · Status.
 *
 * The status machine, enforced in code:
 *   open → decided | rejected        decided → reversed
 * Rules that yield exactly those transitions:
 *  - Birth state is always OPEN.
 *  - A decision may never return to OPEN (nothing is un-asked).
 *  - REJECTED and REVERSED are terminal.
 *  - decide() requires a choice drawn from the stated options, and — if a
 *    Reality Engine is present — every cited ground must currently be VERIFIED.
 *    A decision cannot be committed on unverified or rejected reality.
 * As in all of Core: no delete, no rewrite. A reversal is remembered, not erased.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createDecisionEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var STATUS = ["open", "decided", "rejected", "reversed"];

  function createDecisionEngine(options) {
    options = options || {};
    var memory = options.memory;
    if (!memory || typeof memory.remember !== "function" || typeof memory.amend !== "function" || typeof memory.recall !== "function") {
      throw new TypeError("createDecisionEngine requires a Core Memory instance: createDecisionEngine({ memory })");
    }
    // optional grounding source — a Reality Engine (0007). If given, a decision
    // can only be committed on observations it reports as verified.
    var reality = options.reality || null;
    if (reality && typeof reality.get !== "function") {
      throw new TypeError("createDecisionEngine: reality, if provided, must be a Reality Engine (needs get())");
    }
    var dseq = 0;
    var didgen = options.didgen || function () {
      dseq += 1;
      return "d-" + dseq + "-" + Math.random().toString(16).slice(2, 8);
    };

    /* ---- reads ---- */
    function decisions(includeSuperseded) {
      return memory.recall({ type: "decision", includeSuperseded: !!includeSuperseded });
    }
    function current(did) {
      var all = decisions(false);
      for (var i = 0; i < all.length; i++) {
        if (all[i].meta && all[i].meta.did === did) return all[i];
      }
      return null;
    }
    function get(did) { return current(did); }
    function byStatus(status) {
      if (STATUS.indexOf(status) < 0) throw new TypeError("unknown status: " + status);
      return decisions(false).filter(function (r) { return r.meta.status === status; });
    }
    function history(did) {
      return decisions(true)
        .filter(function (r) { return r.meta && r.meta.did === did; })
        .sort(function (a, b) { return a.at - b.at; });
    }

    /* ---- grounding check: the heart of "verification before acceptance" ---- */
    function assertGroundsVerified(grounds) {
      if (!reality || !grounds || !grounds.length) return; // ungrounded decisions are allowed, but cite nothing
      for (var i = 0; i < grounds.length; i++) {
        var obs = reality.get(grounds[i]);
        if (!obs) throw new Error("decision cannot rest on unknown observation " + grounds[i]);
        if (obs.meta.status !== "verified") {
          throw new Error("decision cannot be committed on observation " + grounds[i] + " — it is " + obs.meta.status + ", not verified");
        }
      }
    }

    /* ---- writes ---- */
    function propose(entry) {
      if (!entry || typeof entry.question !== "string" || !entry.question) {
        throw new TypeError("propose requires an entry with a non-empty string question");
      }
      if (!Array.isArray(entry.options) || entry.options.length < 2) {
        throw new TypeError("propose requires options: an array of at least two choices");
      }
      for (var i = 0; i < entry.options.length; i++) {
        if (typeof entry.options[i] !== "string" || !entry.options[i]) {
          throw new TypeError("every option must be a non-empty string");
        }
      }
      var grounds = entry.grounds ? entry.grounds.slice() : [];
      var did = didgen();
      return memory.remember({
        type: "decision",
        body: entry.question,
        source: entry.source || null,
        confidence: entry.confidence || "medium",
        meta: {
          did: did,
          status: "open",
          options: entry.options.slice(),
          choice: null,
          grounds: grounds,
          rationale: entry.rationale || null,
          note: null
        }
      });
    }

    function transition(did, to, patch, note) {
      var rec = current(did);
      if (!rec) throw new Error("no decision with did " + did);
      var from = rec.meta.status;
      if (from !== "open" && to !== "reversed") throw new Error("decision " + did + " is " + from + " — only an open decision can be decided or rejected");
      if (from === "reversed" || from === "rejected") throw new Error("decision " + did + " is " + from + " — it is closed");
      if (to === "reversed" && from !== "decided") throw new Error("only a decided decision can be reversed; " + did + " is " + from);
      if (from === to) throw new Error("decision " + did + " is already " + to);
      var meta = {
        did: did,
        status: to,
        options: rec.meta.options.slice(),
        choice: (patch && "choice" in patch) ? patch.choice : rec.meta.choice,
        grounds: rec.meta.grounds.slice(),
        rationale: rec.meta.rationale,
        note: note || null
      };
      return memory.amend(rec.id, {
        type: "decision",
        body: rec.body,
        source: rec.source,
        confidence: rec.confidence,
        meta: meta
      });
    }

    function decide(did, choice, note) {
      var rec = current(did);
      if (!rec) throw new Error("no decision with did " + did);
      if (rec.meta.options.indexOf(choice) < 0) {
        throw new Error("choice " + JSON.stringify(choice) + " is not among the stated options — a decision must choose what was considered");
      }
      assertGroundsVerified(rec.meta.grounds);
      return transition(did, "decided", { choice: choice }, note);
    }
    function reject(did, note) { return transition(did, "rejected", null, note); }
    function reverse(did, note) { return transition(did, "reversed", null, note); }

    function status() {
      var all = decisions(false);
      var counts = { open: 0, decided: 0, rejected: 0, reversed: 0 };
      for (var i = 0; i < all.length; i++) counts[all[i].meta.status] += 1;
      return {
        total: all.length,
        open: counts.open,
        decided: counts.decided,
        rejected: counts.rejected,
        reversed: counts.reversed,
        grounded: !!reality
      };
    }

    return {
      propose: propose, decide: decide, reject: reject, reverse: reverse,
      get: get, byStatus: byStatus, decisions: decisions, history: history, status: status
    };
  }

  createDecisionEngine.STATUS = STATUS.slice();
  return createDecisionEngine;
});
