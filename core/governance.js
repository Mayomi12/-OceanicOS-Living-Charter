/*
 * Ω∞ OceanicOS :: Governance
 * Build 0043 · Stage 5 (Collaboration) · zero-runtime (plain browser or any JS engine)
 *
 * Collaboration needs a way to change things ON PURPOSE — a formal path from
 * "someone proposes a change" to "the change is ratified", with review in
 * between and the whole trail preserved. Governance is that path, composed on
 * Identity (0035, who may act) and echoing the authority ladder Permissions
 * (0036) reads: proposing and reviewing are contributions; ratifying or
 * rejecting a change is a steward's act.
 *
 * A proposal carries the four things the Charter's Governance section asks every
 * change to state — rationale, expected impact, implementation plan, migration
 * guidance — and moves through a status machine:
 *
 *   proposed → under-review → ratified | rejected | withdrawn      (terminal ×3)
 *
 * Ratification is refused unless the change has earned a quorum of endorsements
 * AND carries no standing objection — constructive disagreement blocks a rushed
 * change until it is resolved. Everything is stored in the one Memory Ocean
 * (`type:"proposal"` and `type:"proposal-review"`), append-only: a review is
 * superseded, never erased, and earlier versions of the record remain.
 *
 *   propose({ title, rationale, impact, plan, migration, by })
 *   review(pid, actorId, verdict, note?)   · verdict "endorse" | "object"
 *   ratify(pid, actorId) · reject(pid, actorId, reason?) · withdraw(pid, actorId)
 *   get · list · reviews · pending · status
 *
 * Governance is a mechanism, not authority over humans. It records who proposed,
 * who reviewed, and who ratified — but per the ratified Charter (Art. I §3) the
 * final authority remains human, and nothing here silently amends the Charter:
 * a ratified proposal is a recorded decision that humans then enact.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createGovernance = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ROLES = ["observer", "contributor", "steward", "admin"]; // matches Identity's ladder
  function authority(role) { return ROLES.indexOf(role); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "proposal"; }

  var TERMINAL = { ratified: 1, rejected: 1, withdrawn: 1 };
  var VERDICTS = { endorse: 1, object: 1 };

  function createGovernance(options) {
    options = options || {};
    var memory = options.memory || (options.oceanic && options.oceanic.memory);
    if (!memory || typeof memory.remember !== "function" || typeof memory.amend !== "function" || typeof memory.recall !== "function") {
      throw new TypeError("createGovernance requires an OceanicOS or a Memory: createGovernance({ oceanic })");
    }
    var identity = options.identity;
    if (!identity || typeof identity.has !== "function" || typeof identity.get !== "function") {
      throw new TypeError("createGovernance requires an Identity: createGovernance({ oceanic, identity })");
    }
    // optional seam: derive extra authority (e.g. Teams.roleOf) beyond an actor's own role
    var externalRoleOf = typeof options.roleOf === "function" ? options.roleOf : null;
    var quorum = typeof options.quorum === "number" && options.quorum > 0 ? Math.floor(options.quorum) : 1;

    /* ---- authority ---- */
    function effectiveRole(actorId) {
      var a = identity.get(actorId);
      var base = a ? a.role : null;
      var ext = externalRoleOf ? externalRoleOf(actorId) : null;
      if (base === null) return ext;
      if (ext === null) return base;
      return authority(ext) > authority(base) ? ext : base;
    }
    function requireActor(actorId, minRole, verb) {
      if (typeof actorId !== "string" || !actorId) throw new TypeError(verb + " requires an actor id");
      if (!identity.has(actorId)) throw new Error("no active actor '" + actorId + "' in the register");
      var role = effectiveRole(actorId);
      if (authority(role) < authority(minRole)) {
        throw new Error("actor '" + actorId + "' (" + role + ") lacks authority to " + verb + " — needs " + minRole);
      }
      return role;
    }

    /* ---- proposals ---- */
    function proposals() { return memory.recall({ type: "proposal" }); }
    function record(pid) {
      var all = proposals();
      for (var i = 0; i < all.length; i++) if (all[i].meta.pid === pid) return all[i];
      return null;
    }
    function reviewsOf(pid) {
      return memory.recall({ type: "proposal-review" })
        .filter(function (r) { return r.meta.pid === pid; })
        .map(function (r) { return { by: r.meta.by, verdict: r.meta.verdict, note: r.meta.note || null }; });
    }
    function shape(r) {
      if (!r) return null;
      var m = r.meta;
      var revs = reviewsOf(m.pid);
      return {
        id: m.pid, title: r.body, by: m.by, status: m.status,
        rationale: m.rationale, impact: m.impact, plan: m.plan, migration: m.migration,
        decidedBy: m.decidedBy || null, reason: m.reason || null,
        reviews: revs,
        endorsements: revs.filter(function (e) { return e.verdict === "endorse"; }).length,
        objections: revs.filter(function (e) { return e.verdict === "object"; }).length
      };
    }
    function save(rec, patch) {
      var m = rec.meta;
      function pick(k) { return (k in patch) ? patch[k] : m[k]; }
      return memory.amend(rec.id, {
        type: "proposal", body: rec.body, source: "governance", confidence: "certain",
        meta: {
          pid: m.pid, rationale: m.rationale, impact: m.impact, plan: m.plan, migration: m.migration, by: m.by,
          status: pick("status"), decidedBy: pick("decidedBy"), reason: pick("reason")
        }
      });
    }
    function openProposal(pid, verb) {
      var rec = record(pid);
      if (!rec) throw new Error("no proposal with id " + pid);
      if (TERMINAL[rec.meta.status]) throw new Error("proposal " + pid + " is " + rec.meta.status + " — cannot " + verb + " it");
      return rec;
    }

    function propose(entry) {
      if (!entry || typeof entry.title !== "string" || !entry.title) throw new TypeError("propose requires a non-empty title");
      if (typeof entry.rationale !== "string" || !entry.rationale) throw new TypeError("propose requires a rationale — a change must say why");
      requireActor(entry.by, "contributor", "propose a change");
      var pid = entry.id ? slug(entry.id) : slug(entry.title);
      if (record(pid)) throw new Error("a proposal already exists with id " + pid);
      var r = memory.remember({
        type: "proposal", body: entry.title, source: "governance", confidence: "certain",
        meta: {
          pid: pid, by: entry.by, status: "proposed",
          rationale: entry.rationale,
          impact: entry.impact || null, plan: entry.plan || null, migration: entry.migration || null,
          decidedBy: null, reason: null
        }
      });
      return shape(r);
    }

    function review(pid, actorId, verdict, note) {
      var rec = openProposal(pid, "review");
      if (!VERDICTS[verdict]) throw new TypeError("review verdict must be 'endorse' or 'object'");
      requireActor(actorId, "contributor", "review a change");
      if (actorId === rec.meta.by) throw new Error("a proposer cannot review their own proposal — withdraw it instead");
      // one current review per actor: supersede the actor's prior review if any (history preserved)
      var prior = null, all = memory.recall({ type: "proposal-review" });
      for (var i = 0; i < all.length; i++) if (all[i].meta.pid === pid && all[i].meta.by === actorId) { prior = all[i]; break; }
      // Memory refuses an empty body, so the body is a human line and the note lives in meta.
      var reviewRec = { type: "proposal-review", body: actorId + " " + verdict + "s", source: "governance",
        confidence: "certain", meta: { pid: pid, by: actorId, verdict: verdict, note: note || null } };
      if (prior) memory.amend(prior.id, reviewRec);
      else memory.remember(reviewRec);
      if (rec.meta.status === "proposed") rec = save(rec, { status: "under-review" });
      return shape(rec);
    }

    function ratify(pid, actorId) {
      var rec = openProposal(pid, "ratify");
      requireActor(actorId, "steward", "ratify a change");
      var revs = reviewsOf(pid);
      var objections = revs.filter(function (e) { return e.verdict === "object"; }).length;
      if (objections > 0) throw new Error("cannot ratify " + pid + " — " + objections + " standing objection(s) must be resolved first");
      var endorsements = revs.filter(function (e) { return e.verdict === "endorse"; }).length;
      if (endorsements < quorum) throw new Error("cannot ratify " + pid + " — needs " + quorum + " endorsement(s), has " + endorsements);
      return shape(save(rec, { status: "ratified", decidedBy: actorId }));
    }

    function reject(pid, actorId, reason) {
      var rec = openProposal(pid, "reject");
      requireActor(actorId, "steward", "reject a change");
      return shape(save(rec, { status: "rejected", decidedBy: actorId, reason: reason || null }));
    }

    function withdraw(pid, actorId) {
      var rec = openProposal(pid, "withdraw");
      if (typeof actorId !== "string" || !actorId) throw new TypeError("withdraw requires an actor id");
      var isProposer = actorId === rec.meta.by;
      var isAdmin = identity.has(actorId) && authority(effectiveRole(actorId)) >= authority("admin");
      if (!isProposer && !isAdmin) throw new Error("only the proposer ('" + rec.meta.by + "') or an admin may withdraw " + pid);
      return shape(save(rec, { status: "withdrawn", decidedBy: actorId }));
    }

    /* ---- reads (never throw for known ids; do throw for unknown) ---- */
    function get(pid) { return shape(record(pid)); }
    function reviews(pid) { if (!record(pid)) throw new Error("no proposal with id " + pid); return reviewsOf(pid); }
    function list(filter) {
      filter = filter || {};
      return proposals().map(shape).filter(function (p) { return filter.status ? p.status === filter.status : true; });
    }
    function pending() { return list().filter(function (p) { return !TERMINAL[p.status]; }); }
    function status() {
      var all = list(), counts = {};
      all.forEach(function (p) { counts[p.status] = (counts[p.status] || 0) + 1; });
      return { proposals: all.length, byStatus: counts, pending: pending().length, quorum: quorum };
    }

    return {
      propose: propose, review: review, ratify: ratify, reject: reject, withdraw: withdraw,
      get: get, reviews: reviews, list: list, pending: pending, status: status
    };
  }

  createGovernance.ROLES = ROLES.slice();
  createGovernance.STATUSES = ["proposed", "under-review", "ratified", "rejected", "withdrawn"];
  return createGovernance;
});
