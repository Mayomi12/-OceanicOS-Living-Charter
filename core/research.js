/*
 * Ω∞ OceanicOS :: Research
 * Build 0054 · Stage 7 (Ecosystem) · zero-runtime (plain browser or any JS engine)
 *
 * An ecosystem that only consumes knowledge starves; Research is how it MAKES
 * knowledge, honestly. An inquiry is a question pursued in the open:
 *
 *   open({ question, by? })            → an inquiry (type:"inquiry", append-only)
 *   hypothesize(rid, statement)        → a candidate answer (h1, h2, …)
 *   evidence(rid, hid, oid, stance)    → attach a REAL observation, declared
 *                                        "supports" or "contradicts"
 *   assess(rid, hid)                   → the LIVE verdict, derived from what
 *                                        reality currently says:
 *                                          refuted       — verified contradicting evidence stands
 *                                          supported     — verified support, nothing verified against
 *                                          undetermined  — no verified evidence either way
 *   conclude(rid, hid, topics?)        → graduate a SUPPORTED hypothesis into
 *                                        the Knowledge Engine, grounded on its
 *                                        verified supporting observations —
 *                                        REFUSED for anything less
 *   close(rid, summary)                → end the inquiry openly (terminal)
 *   findings(rid) · get · list · status
 *
 * The verdict is a lens, not a stamp: if a supporting observation is later
 * rejected, assess() changes its mind — and the Reasoner (0028) will flag any
 * already-graduated knowledge that rested on it. Verification before
 * acceptance, applied to the making of knowledge itself.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createResearch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "inquiry"; }
  var STANCES = { supports: 1, contradicts: 1 };

  function createResearch(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || !os.memory || !os.reality || !os.knowledge) {
      throw new TypeError("createResearch requires an assembled OceanicOS: createResearch({ oceanic })");
    }
    var memory = os.memory;

    /* ---- storage ---- */
    function inquiries() { return memory.recall({ type: "inquiry" }); }
    function record(rid) {
      var all = inquiries();
      for (var i = 0; i < all.length; i++) if (all[i].meta.rid === rid) return all[i];
      return null;
    }
    function openRecord(rid, verb) {
      var rec = record(rid);
      if (!rec) throw new Error("no inquiry with id " + rid);
      if (rec.meta.status !== "open") throw new Error("inquiry " + rid + " is " + rec.meta.status + " — cannot " + verb + " it");
      return rec;
    }
    function hypOf(rec, hid) {
      for (var i = 0; i < rec.meta.hypotheses.length; i++) if (rec.meta.hypotheses[i].hid === hid) return rec.meta.hypotheses[i];
      throw new Error("no hypothesis " + hid + " in inquiry " + rec.meta.rid);
    }
    function cloneHyps(hyps) {
      return hyps.map(function (h) {
        return { hid: h.hid, statement: h.statement, status: h.status, kid: h.kid || null,
                 evidence: h.evidence.map(function (e) { return { oid: e.oid, stance: e.stance }; }) };
      });
    }
    function save(rec, patch) {
      var m = rec.meta;
      return memory.amend(rec.id, {
        type: "inquiry", body: rec.body, source: "research", confidence: "certain",
        meta: { rid: m.rid, by: m.by,
                status: ("status" in patch) ? patch.status : m.status,
                summary: ("summary" in patch) ? patch.summary : (m.summary || null),
                hypotheses: ("hypotheses" in patch) ? patch.hypotheses : m.hypotheses }
      });
    }
    function shape(rec) {
      if (!rec) return null;
      var m = rec.meta;
      return { id: m.rid, question: rec.body, by: m.by, status: m.status, summary: m.summary || null,
               hypotheses: cloneHyps(m.hypotheses).map(function (h) {
                 h.verdict = m.status === "open" || true ? verdictOf(h) : null; return h;
               }) };
    }

    /* ---- the live verdict ---- */
    function verdictOf(h) {
      var supporting = 0, contradicting = 0, awaiting = 0;
      h.evidence.forEach(function (e) {
        var obs = os.reality.get(e.oid);
        if (!obs) return;
        if (obs.meta.status === "verified") {
          if (e.stance === "supports") supporting += 1; else contradicting += 1;
        } else if (obs.meta.status === "pending") awaiting += 1;
      });
      if (contradicting > 0) return { verdict: "refuted", supporting: supporting, contradicting: contradicting, awaiting: awaiting };
      if (supporting > 0) return { verdict: "supported", supporting: supporting, contradicting: 0, awaiting: awaiting };
      return { verdict: "undetermined", supporting: 0, contradicting: 0, awaiting: awaiting };
    }

    /* ---- the inquiry lifecycle ---- */
    function open(entry) {
      if (!entry || typeof entry.question !== "string" || !entry.question) throw new TypeError("open requires a question — research begins with one");
      var rid = entry.id ? slug(entry.id) : slug(entry.question);
      if (record(rid)) throw new Error("an inquiry already exists with id " + rid);
      var r = memory.remember({
        type: "inquiry", body: entry.question, source: "research", confidence: "certain",
        meta: { rid: rid, by: entry.by || null, status: "open", summary: null, hypotheses: [] }
      });
      return shape(r);
    }

    function hypothesize(rid, statement) {
      var rec = openRecord(rid, "add a hypothesis to");
      if (typeof statement !== "string" || !statement) throw new TypeError("hypothesize requires a statement");
      var hyps = cloneHyps(rec.meta.hypotheses);
      hyps.push({ hid: "h" + (hyps.length + 1), statement: statement, status: "proposed", kid: null, evidence: [] });
      return shape(save(rec, { hypotheses: hyps }));
    }

    function evidence(rid, hid, oid, stance) {
      var rec = openRecord(rid, "attach evidence to");
      if (!STANCES[stance]) throw new TypeError("stance must be 'supports' or 'contradicts' — evidence declares its direction");
      if (!os.reality.get(oid)) throw new Error("no observation " + oid + " in the ocean — evidence must be REAL, recorded reality");
      var hyps = cloneHyps(rec.meta.hypotheses);
      var h = null;
      for (var i = 0; i < hyps.length; i++) if (hyps[i].hid === hid) h = hyps[i];
      if (!h) throw new Error("no hypothesis " + hid + " in inquiry " + rid);
      if (h.status === "concluded") throw new Error("hypothesis " + hid + " is already concluded — open a new inquiry to challenge it");
      h.evidence.push({ oid: oid, stance: stance });
      return shape(save(rec, { hypotheses: hyps }));
    }

    function assess(rid, hid) {
      var rec = record(rid);
      if (!rec) throw new Error("no inquiry with id " + rid);
      return verdictOf(hypOf(rec, hid));
    }

    function conclude(rid, hid, topics) {
      var rec = openRecord(rid, "conclude in");
      var hyps = cloneHyps(rec.meta.hypotheses);
      var h = null;
      for (var i = 0; i < hyps.length; i++) if (hyps[i].hid === hid) h = hyps[i];
      if (!h) throw new Error("no hypothesis " + hid + " in inquiry " + rid);
      if (h.status === "concluded") throw new Error("hypothesis " + hid + " is already concluded");
      var v = verdictOf(h);
      if (v.verdict !== "supported") {
        throw new Error("cannot conclude " + hid + " — it is " + v.verdict +
          (v.awaiting ? " (" + v.awaiting + " piece(s) of evidence still awaiting verification)" : "") +
          "; only a SUPPORTED hypothesis graduates into knowledge");
      }
      var grounds = h.evidence.filter(function (e) {
        var obs = os.reality.get(e.oid);
        return e.stance === "supports" && obs && obs.meta.status === "verified";
      }).map(function (e) { return e.oid; });
      var k = os.knowledge.learn({ statement: h.statement, topics: (topics || []).concat(["research", rid]), grounds: grounds });
      h.status = "concluded";
      h.kid = k.meta.kid;
      shape(save(rec, { hypotheses: hyps }));
      return { inquiry: rid, hypothesis: hid, knowledge: k.meta.kid, grounds: grounds };
    }

    function close(rid, summary) {
      var rec = openRecord(rid, "close");
      if (typeof summary !== "string" || !summary) throw new TypeError("close requires a summary — an inquiry ends by saying what was learned (or why it stopped)");
      return shape(save(rec, { status: "closed", summary: summary }));
    }

    /* ---- reads ---- */
    function get(rid) { return shape(record(rid)); }
    function list(filter) {
      filter = filter || {};
      return inquiries().map(shape).filter(function (q) { return filter.status ? q.status === filter.status : true; });
    }
    function findings(rid) {
      var rec = record(rid);
      if (!rec) throw new Error("no inquiry with id " + rid);
      return rec.meta.hypotheses.filter(function (h) { return h.status === "concluded"; })
        .map(function (h) { return { hypothesis: h.hid, statement: h.statement, knowledge: h.kid }; });
    }
    function status() {
      var all = list();
      var hyps = 0, concluded = 0;
      all.forEach(function (q) { hyps += q.hypotheses.length;
        concluded += q.hypotheses.filter(function (h) { return h.status === "concluded"; }).length; });
      return { inquiries: all.length,
               open: all.filter(function (q) { return q.status === "open"; }).length,
               hypotheses: hyps, concluded: concluded };
    }

    return { open: open, hypothesize: hypothesize, evidence: evidence, assess: assess,
             conclude: conclude, close: close, findings: findings, get: get, list: list, status: status };
  }

  return createResearch;
});
