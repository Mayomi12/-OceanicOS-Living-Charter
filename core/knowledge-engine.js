/*
 * Ω∞ OceanicOS Core :: Knowledge Engine
 * Build 0009 · Stage 1 · zero-runtime (plain browser or any JS engine)
 *
 * The distilled water of the Memory Ocean. Reality (0007) holds raw
 * observations; Decisions (0008) hold what we chose to do; Knowledge holds what
 * we have come to KNOW — durable, topic-indexed statements, each able to name
 * the reality it rests on.
 *
 * Composition, not reinvention: like its siblings, Knowledge is stored in a
 * Core Memory (0005) — append-only, provenance, optional persistence, for free.
 * A Reality Engine may be supplied so that grounded knowledge is held honestly:
 * any ground that names a known observation must be VERIFIED — knowledge is not
 * built on pending or rejected reality. Grounds that are not observations pass
 * through as external provenance.
 *
 * A piece of knowledge carries:
 *   Statement · Topics · Grounds · Source · Confidence · Status.
 *
 * Unlike Reality and Decisions, Knowledge is REVISED in place (its statement can
 * change as understanding deepens) while keeping its identity — every revision
 * is a Memory amendment, so the older wording is preserved, never rewritten.
 *
 * The status machine, enforced in code:
 *   established → deprecated        (deprecated is terminal)
 * A revision keeps knowledge established; deprecation retires it without erasing
 * it. As in all of Core: no delete, no rewrite.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createKnowledgeEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var STATUS = ["established", "deprecated"];

  function normalizeTopics(topics) {
    if (topics == null) return [];
    if (!Array.isArray(topics)) throw new TypeError("topics must be an array of non-empty strings");
    var out = [];
    for (var i = 0; i < topics.length; i++) {
      var topic = topics[i];
      if (typeof topic !== "string" || !topic) throw new TypeError("every topic must be a non-empty string");
      var lc = topic.toLowerCase();
      if (out.indexOf(lc) < 0) out.push(lc); // topics are lowercased and de-duplicated for stable retrieval
    }
    return out;
  }

  function createKnowledgeEngine(options) {
    options = options || {};
    var memory = options.memory;
    if (!memory || typeof memory.remember !== "function" || typeof memory.amend !== "function" || typeof memory.recall !== "function") {
      throw new TypeError("createKnowledgeEngine requires a Core Memory instance: createKnowledgeEngine({ memory })");
    }
    var reality = options.reality || null;
    if (reality && typeof reality.get !== "function") {
      throw new TypeError("createKnowledgeEngine: reality, if provided, must be a Reality Engine (needs get())");
    }
    var kseq = 0;
    var kidgen = options.kidgen || function () {
      kseq += 1;
      return "k-" + kseq + "-" + Math.random().toString(16).slice(2, 8);
    };

    /* ---- reads ---- */
    function knowledge(includeSuperseded) {
      return memory.recall({ type: "knowledge", includeSuperseded: !!includeSuperseded });
    }
    function current(kid) {
      var all = knowledge(false);
      for (var i = 0; i < all.length; i++) {
        if (all[i].meta && all[i].meta.kid === kid) return all[i];
      }
      return null;
    }
    function get(kid) { return current(kid); }
    function byStatus(status) {
      if (STATUS.indexOf(status) < 0) throw new TypeError("unknown status: " + status);
      return knowledge(false).filter(function (r) { return r.meta.status === status; });
    }
    function byTopic(topic) {
      if (typeof topic !== "string" || !topic) throw new TypeError("byTopic requires a topic string");
      var lc = topic.toLowerCase();
      return knowledge(false).filter(function (r) { return r.meta.topics.indexOf(lc) >= 0; });
    }
    function search(text) {
      var q = String(text || "").toLowerCase();
      if (!q) return [];
      return knowledge(false).filter(function (r) { return r.body.toLowerCase().indexOf(q) >= 0; });
    }
    function topics() {
      var counts = {};
      knowledge(false).forEach(function (r) {
        r.meta.topics.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
      });
      return counts;
    }
    function history(kid) {
      return knowledge(true)
        .filter(function (r) { return r.meta && r.meta.kid === kid; })
        .sort(function (a, b) { return a.at - b.at; });
    }

    /* ---- grounding: knowledge that names a known observation needs it verified ---- */
    function assertGroundsHonest(grounds) {
      if (!reality || !grounds || !grounds.length) return;
      for (var i = 0; i < grounds.length; i++) {
        var obs = reality.get(grounds[i]);
        if (obs && obs.meta.status !== "verified") {
          throw new Error("knowledge cannot rest on observation " + grounds[i] + " — it is " + obs.meta.status + ", not verified");
        }
        // grounds that are not observations (reality.get -> null) are external provenance and allowed
      }
    }

    /* ---- writes ---- */
    function learn(entry) {
      if (!entry || typeof entry.statement !== "string" || !entry.statement) {
        throw new TypeError("learn requires an entry with a non-empty string statement");
      }
      var topicList = normalizeTopics(entry.topics);
      var grounds = entry.grounds ? entry.grounds.slice() : [];
      assertGroundsHonest(grounds);
      var kid = kidgen();
      return memory.remember({
        type: "knowledge",
        body: entry.statement,
        source: entry.source || null,
        confidence: entry.confidence || "medium",
        meta: {
          kid: kid,
          status: "established",
          topics: topicList,
          grounds: grounds,
          note: null
        }
      });
    }

    function revise(kid, patch) {
      var rec = current(kid);
      if (!rec) throw new Error("no knowledge with kid " + kid);
      if (rec.meta.status !== "established") throw new Error("knowledge " + kid + " is " + rec.meta.status + " — deprecated knowledge is not revised, it is superseded by new knowledge");
      patch = patch || {};
      var statement = ("statement" in patch) ? patch.statement : rec.body;
      if (typeof statement !== "string" || !statement) throw new TypeError("revise: statement must be a non-empty string");
      var topicList = ("topics" in patch) ? normalizeTopics(patch.topics) : rec.meta.topics.slice();
      var grounds = ("grounds" in patch) ? (patch.grounds ? patch.grounds.slice() : []) : rec.meta.grounds.slice();
      assertGroundsHonest(grounds);
      return memory.amend(rec.id, {
        type: "knowledge",
        body: statement,
        source: ("source" in patch) ? patch.source : rec.source,
        confidence: patch.confidence || rec.confidence,
        meta: {
          kid: kid,
          status: "established",
          topics: topicList,
          grounds: grounds,
          note: patch.note || null
        }
      });
    }

    function deprecate(kid, note) {
      var rec = current(kid);
      if (!rec) throw new Error("no knowledge with kid " + kid);
      if (rec.meta.status === "deprecated") throw new Error("knowledge " + kid + " is already deprecated");
      return memory.amend(rec.id, {
        type: "knowledge",
        body: rec.body,
        source: rec.source,
        confidence: rec.confidence,
        meta: {
          kid: kid,
          status: "deprecated",
          topics: rec.meta.topics.slice(),
          grounds: rec.meta.grounds.slice(),
          note: note || null
        }
      });
    }

    function status() {
      var all = knowledge(false);
      var counts = { established: 0, deprecated: 0 };
      for (var i = 0; i < all.length; i++) counts[all[i].meta.status] += 1;
      return {
        total: all.length,
        established: counts.established,
        deprecated: counts.deprecated,
        topics: Object.keys(topics()).length,
        grounded: !!reality
      };
    }

    return {
      learn: learn, revise: revise, deprecate: deprecate,
      get: get, byStatus: byStatus, byTopic: byTopic, search: search,
      topics: topics, knowledge: knowledge, history: history, status: status
    };
  }

  createKnowledgeEngine.STATUS = STATUS.slice();
  return createKnowledgeEngine;
});
