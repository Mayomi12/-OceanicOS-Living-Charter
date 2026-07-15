/*
 * Ω∞ OceanicOS :: Community — The Commons
 * Build 0055 · Stage 7 (Ecosystem) · zero-runtime (plain browser or any JS engine)
 *
 * The last Ecosystem capability is the one that keeps it alive: the path that
 * turns a NEWCOMER into a BUILDER. The Commons composes Identity (0035) and
 * Governance (0043) into a contribution flow with an open door and honest gates:
 *
 *   welcome(name)                  → anyone may join, as an observer
 *   offer({ title, kind, summary, by })
 *                                  → ANY member may offer a contribution — in
 *                                    the commons, offering and reviewing are
 *                                    open to all members by design (that is
 *                                    how you become a contributor), while
 *                                    ACCEPTING remains a steward's act
 *   review(cid, by, verdict, note) → endorse or object (never your own offer)
 *   accept(cid, steward)           → ratify: quorum met, no standing objection
 *                                    — and a first-time offerer is PROMOTED
 *                                    observer → contributor, on the record
 *   decline(cid, steward, reason)  → refused openly, with the reason kept
 *   credits(actorId) · builders() · path(actorId) · get · list · status
 *
 * Nothing here is a new storage type: a contribution IS a governance proposal
 * (its kind carried in the impact field), so the whole trail — offers, reviews,
 * acceptances, declines — lives under the same law as every other change.
 * Belonging is not authority; contribution, reviewed and accepted, is.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createCommons = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var KINDS = { capability: 1, template: 1, lesson: 1, fix: 1, doc: 1 };

  function createCommons(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || !os.memory) throw new TypeError("createCommons requires an assembled OceanicOS: createCommons({ oceanic, identity })");
    var identity = options.identity;
    if (!identity || typeof identity.has !== "function" || typeof identity.setRole !== "function") {
      throw new TypeError("createCommons requires an Identity (0035): createCommons({ oceanic, identity })");
    }
    var C = (root && root.OceanicCore) || {};
    var governanceFactory = options.governanceFactory || C.createGovernance;
    if (typeof governanceFactory !== "function") throw new Error("createCommons needs Governance — load core/governance.js first, or pass { governanceFactory }");

    // In the commons every active member may offer and review (that is the door
    // to becoming a contributor); stewards still hold the accepting authority.
    var G = governanceFactory({
      oceanic: os, identity: identity,
      quorum: typeof options.quorum === "number" ? options.quorum : 1,
      roleOf: function (actorId) { return identity.has(actorId) ? "contributor" : null; }
    });

    function shape(p) {
      if (!p) return null;
      return { id: p.id, title: p.title, kind: p.impact, summary: p.rationale, by: p.by,
               status: p.status === "ratified" ? "accepted" : p.status === "rejected" ? "declined" : p.status,
               reason: p.reason, endorsements: p.endorsements, objections: p.objections,
               acceptedBy: p.status === "ratified" ? p.decidedBy : null };
    }

    /* ---- the open door ---- */
    function welcome(name) {
      var member = identity.register({ name: name, role: "observer" });
      return { id: member.id, name: member.name, role: member.role,
               message: "welcome to the commons — offer a drop, review a drop, become a builder" };
    }

    /* ---- the contribution flow (a governance proposal underneath) ---- */
    function offer(entry) {
      if (!entry || typeof entry.title !== "string" || !entry.title) throw new TypeError("offer requires a title");
      if (typeof entry.summary !== "string" || !entry.summary) throw new TypeError("offer requires a summary — say what the drop does");
      if (!KINDS[entry.kind]) throw new TypeError("offer kind must be one of: " + Object.keys(KINDS).join(", "));
      var p = G.propose({ title: entry.title, rationale: entry.summary, impact: entry.kind,
                          plan: entry.plan || null, by: entry.by });
      return shape(p);
    }

    function review(cid, by, verdict, note) { return shape(G.review(cid, by, verdict, note)); }

    function accept(cid, steward) {
      var before = G.get(cid);
      if (!before) throw new Error("no contribution with id " + cid);
      var p = G.ratify(cid, steward); // steward authority + quorum + no objections, all inherited
      var offerer = identity.get(p.by);
      var promoted = false;
      if (offerer && offerer.status === "active" && offerer.role === "observer") {
        identity.setRole(p.by, "contributor"); // the first accepted drop makes a builder — on the record
        promoted = true;
      }
      return { contribution: shape(p), promoted: promoted,
               offerer: identity.get(p.by) };
    }

    function decline(cid, steward, reason) {
      if (typeof reason !== "string" || !reason) throw new TypeError("decline requires a reason — a refused drop deserves to know why");
      return shape(G.reject(cid, steward, reason));
    }

    /* ---- the ledger of builders ---- */
    function accepted() { return G.list({ status: "ratified" }); }
    function credits(actorId) {
      return accepted().filter(function (p) { return p.by === actorId; }).length;
    }
    function builders() {
      var byActor = {};
      accepted().forEach(function (p) { byActor[p.by] = (byActor[p.by] || 0) + 1; });
      return Object.keys(byActor).sort().map(function (id) {
        var a = identity.get(id);
        return { id: id, name: a ? a.name : id, role: a ? a.role : null, accepted: byActor[id] };
      });
    }
    function path(actorId) {
      var a = identity.get(actorId);
      if (!a) throw new Error("no member '" + actorId + "' in the register");
      var offered = G.list().filter(function (p) { return p.by === actorId; }).length;
      var won = credits(actorId);
      return { member: a.name, role: a.role, offered: offered, accepted: won,
               isBuilder: won >= 1,
               next: won >= 1 ? "keep the drops coming" : offered >= 1 ? "gather a review and a steward's acceptance" : "offer your first drop" };
    }

    function get(cid) { return shape(G.get(cid)); }
    function list(filter) {
      var mapped = G.list().map(shape);
      return filter && filter.status ? mapped.filter(function (c) { return c.status === filter.status; }) : mapped;
    }
    function status() {
      var all = list();
      return { members: identity.list().length,
               contributions: all.length,
               accepted: all.filter(function (c) { return c.status === "accepted"; }).length,
               declined: all.filter(function (c) { return c.status === "declined"; }).length,
               builders: builders().length };
    }

    return { welcome: welcome, offer: offer, review: review, accept: accept, decline: decline,
             credits: credits, builders: builders, path: path, get: get, list: list, status: status };
  }

  createCommons.KINDS = Object.keys(KINDS);
  return createCommons;
});
