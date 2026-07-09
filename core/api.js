/*
 * Ω∞ OceanicOS :: API
 * Build 0017 · Stage 2 (Builder) · zero-runtime (plain browser or any JS engine)
 *
 * A stable, versioned, self-describing contract over the assembled system. The
 * CLI (0012) is for people (text in, text out); the API is for programs (typed
 * params in, JSON-shaped data out). Both drive the same Kernel (0011), but the
 * API makes two promises the CLI does not:
 *
 *  1. STABLE SHAPES. Every operation returns plain, documented data — an
 *     observation is always { id, status, observation, source, confidence } —
 *     never a raw internal Memory record. Callers depend on the contract, not
 *     on how the engines happen to store things today.
 *  2. INTROSPECTION. describe() returns a machine-readable manifest of every
 *     operation: its group, summary, parameters, and return shape. The system
 *     documents itself (and build 0018 renders that manifest for humans).
 *
 * Like the CLI, call() and every method return { ok, data, error } and NEVER
 * throw — a missing parameter or an engine refusal is reported, not raised.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createAPI = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0"; // the API contract version — bumped only on breaking changes

  // ---- stable output shapes (independent of internal record structure) ----
  function shapeObservation(r) {
    return { id: r.meta.oid, status: r.meta.status, observation: r.body, source: r.source, evidence: r.meta.evidence, confidence: r.confidence };
  }
  function shapeDecision(r) {
    return { id: r.meta.did, status: r.meta.status, question: r.body, options: r.meta.options.slice(), choice: r.meta.choice, grounds: r.meta.grounds.slice() };
  }
  function shapeKnowledge(r) {
    return { id: r.meta.kid, status: r.meta.status, statement: r.body, topics: r.meta.topics.slice() };
  }
  function shapeProject(r) {
    return { id: r.meta.pid, status: r.meta.status, name: r.body, goal: r.meta.goal, links: r.meta.links.map(function (l) { return { kind: l.kind, id: l.id }; }) };
  }
  function shapeBuild(r) {
    return { number: r.meta.number, stage: r.meta.stage, capability: r.meta.capability, release: r.meta.release };
  }

  function createAPI(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || typeof os.start !== "function" || !os.reality || !os.decisions || !os.knowledge || !os.projects || !os.builds) {
      throw new TypeError("createAPI requires an assembled OceanicOS: createAPI({ oceanic })");
    }

    // ---- the operation registry: one source of truth for behaviour AND docs ----
    var OPS = [
      { name: "system.start", group: "system", summary: "Boot the system on a pulse.",
        params: [], returns: "{ started, pulse, at }",
        run: function () { return os.start(); } },
      { name: "system.status", group: "system", summary: "Aggregate status of the whole system.",
        params: [], returns: "{ version, booted, pulse, memory, reality, ... }",
        run: function () { return os.status(); } },

      { name: "reality.observe", group: "reality", summary: "Record an observation (born pending).",
        params: [p("observation", "string", true), p("source", "string"), p("evidence", "string"), p("confidence", "string")],
        returns: "observation", run: function (a) {
          return shapeObservation(os.reality.observe({ observation: a.observation, source: a.source, evidence: a.evidence, confidence: a.confidence })); } },
      { name: "reality.verify", group: "reality", summary: "Mark an observation verified.",
        params: [p("id", "string", true), p("note", "string")], returns: "observation",
        run: function (a) { return shapeObservation(os.reality.verify(a.id, a.note)); } },
      { name: "reality.reject", group: "reality", summary: "Mark an observation rejected.",
        params: [p("id", "string", true), p("note", "string")], returns: "observation",
        run: function (a) { return shapeObservation(os.reality.reject(a.id, a.note)); } },
      { name: "reality.archive", group: "reality", summary: "Archive an observation (terminal).",
        params: [p("id", "string", true), p("note", "string")], returns: "observation",
        run: function (a) { return shapeObservation(os.reality.archive(a.id, a.note)); } },
      { name: "reality.list", group: "reality", summary: "List observations, optionally by status.",
        params: [p("status", "string")], returns: "observation[]",
        run: function (a) { return (a.status ? os.reality.byStatus(a.status) : os.reality.observations(false)).map(shapeObservation); } },

      { name: "decision.propose", group: "decision", summary: "Open a decision with >=2 options.",
        params: [p("question", "string", true), p("options", "array", true), p("grounds", "array"), p("rationale", "string")],
        returns: "decision", run: function (a) {
          return shapeDecision(os.decisions.propose({ question: a.question, options: a.options, grounds: a.grounds, rationale: a.rationale })); } },
      { name: "decision.decide", group: "decision", summary: "Commit a decision (choice must be an option; grounds must be verified).",
        params: [p("id", "string", true), p("choice", "string", true), p("note", "string")], returns: "decision",
        run: function (a) { return shapeDecision(os.decisions.decide(a.id, a.choice, a.note)); } },
      { name: "decision.list", group: "decision", summary: "List decisions, optionally by status.",
        params: [p("status", "string")], returns: "decision[]",
        run: function (a) { return (a.status ? os.decisions.byStatus(a.status) : os.decisions.decisions(false)).map(shapeDecision); } },

      { name: "knowledge.learn", group: "knowledge", summary: "Record topic-indexed knowledge.",
        params: [p("statement", "string", true), p("topics", "array"), p("grounds", "array")], returns: "knowledge",
        run: function (a) { return shapeKnowledge(os.knowledge.learn({ statement: a.statement, topics: a.topics, grounds: a.grounds })); } },
      { name: "knowledge.list", group: "knowledge", summary: "List knowledge, optionally by topic.",
        params: [p("topic", "string")], returns: "knowledge[]",
        run: function (a) { return (a.topic ? os.knowledge.byTopic(a.topic) : os.knowledge.knowledge(false)).map(shapeKnowledge); } },

      { name: "project.open", group: "project", summary: "Open a project toward a goal.",
        params: [p("name", "string", true), p("goal", "string")], returns: "project",
        run: function (a) { return shapeProject(os.projects.open({ name: a.name, goal: a.goal })); } },
      { name: "project.link", group: "project", summary: "Attach a typed thread to a project.",
        params: [p("id", "string", true), p("kind", "string", true), p("ref", "string", true)], returns: "project",
        run: function (a) { return shapeProject(os.projects.link(a.id, { kind: a.kind, id: a.ref })); } },
      { name: "project.list", group: "project", summary: "List projects, optionally by status.",
        params: [p("status", "string")], returns: "project[]",
        run: function (a) { return (a.status ? os.projects.byStatus(a.status) : os.projects.projects(false)).map(shapeProject); } },

      { name: "builds.list", group: "builds", summary: "The build ledger, in order.",
        params: [], returns: "build[]", run: function () { return os.builds.history().map(shapeBuild); } },

      { name: "snapshot", group: "system", summary: "Size of the one Memory Ocean.",
        params: [], returns: "{ bytes, records }",
        run: function () { var s = os.exportSnapshot(); return { bytes: s.length, records: os.status().memory.count }; } }
    ];

    function p(name, type, required) { return { name: name, type: type, required: !!required }; }

    var byName = {};
    OPS.forEach(function (op) { byName[op.name] = op; });

    function validate(op, params) {
      params = params || {};
      for (var i = 0; i < op.params.length; i++) {
        var spec = op.params[i];
        var v = params[spec.name];
        if (spec.required && (v === undefined || v === null || v === "")) {
          throw new Error("missing required parameter: " + spec.name + " (" + spec.type + ")");
        }
        if (v !== undefined && v !== null) {
          if (spec.type === "array" && !Array.isArray(v)) throw new Error("parameter " + spec.name + " must be an array");
          if (spec.type === "string" && typeof v !== "string") throw new Error("parameter " + spec.name + " must be a string");
        }
      }
    }

    function call(name, params) {
      var op = byName[name];
      if (!op) return { ok: false, op: name, data: null, error: "unknown operation: " + name };
      try {
        validate(op, params);
        return { ok: true, op: name, data: op.run(params || {}), error: null };
      } catch (e) {
        return { ok: false, op: name, data: null, error: String(e && e.message ? e.message : e) };
      }
    }

    function describe() {
      return {
        version: VERSION,
        operations: OPS.map(function (op) {
          return {
            name: op.name, group: op.group, summary: op.summary,
            params: op.params.map(function (s) { return { name: s.name, type: s.type, required: s.required }; }),
            returns: op.returns
          };
        })
      };
    }

    function operations() { return OPS.map(function (op) { return op.name; }); }

    return { version: VERSION, call: call, describe: describe, operations: operations, oceanic: os };
  }

  createAPI.VERSION = VERSION;
  return createAPI;
});
