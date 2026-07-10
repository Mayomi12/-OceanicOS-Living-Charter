/*
 * Ω∞ OceanicOS :: Templates
 * Build 0051 · Stage 7 (Ecosystem) · zero-runtime (plain browser or any JS engine)
 *
 * An ecosystem grows when a newcomer can start from a WORKING SHAPE instead of
 * zero. A template is a named, described recipe that instantiates a fresh,
 * fully real OceanicOS already arranged for a purpose — actors registered,
 * spaces created, engines wired — with every capability it composes coming
 * from the verified catalogue, never re-implemented.
 *
 *   list()                     → the catalogue (built-ins + registered)
 *   register(name, def)        → contribute a template ({ description, setup(ctx) })
 *   instantiate(name, opts?)   → a fresh kernel + the template's parts + a
 *                                seeded summary; each instance fully isolated
 *
 * Built-ins:
 *   research-workspace — a team investigating a question: Identity + Workspace
 *                        + a first verified observation + Shared Knowledge lens
 *   ops-watch          — an operated system: Logger + Monitor + CI/CD whose
 *                        verify step REFUSES until real verification is wired
 *                        (a template must not fake a green light)
 *   governance-body    — a chair and members with a two-endorsement quorum,
 *                        ready to propose → review → ratify
 *
 * Templates create starting points, not authority: what they seed obeys every
 * law the engines already enforce.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createTemplates = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function createTemplates(options) {
    options = options || {};
    var C = options.core || (root && root.OceanicCore) || {};
    var oceanicFactory = options.oceanicFactory || C.createOceanic;
    if (typeof oceanicFactory !== "function") {
      throw new Error("createTemplates needs the Kernel factory — load core/oceanic.js first, or pass { oceanicFactory }");
    }
    function needFactory(name) {
      if (typeof C[name] !== "function") throw new Error("this template needs " + name + " — load its module first");
      return C[name];
    }

    var registry = {};

    function register(name, def) {
      if (typeof name !== "string" || !name) throw new TypeError("register requires a template name");
      if (registry[name]) throw new Error("a template named '" + name + "' already exists");
      if (!def || typeof def.description !== "string" || !def.description) throw new TypeError("a template requires a description — a shape must say what it is for");
      if (typeof def.setup !== "function") throw new TypeError("a template requires a setup(ctx) function");
      registry[name] = { description: def.description, setup: def.setup, builtin: !!def._builtin };
      return list();
    }

    function list() {
      return Object.keys(registry).sort().map(function (n) {
        return { name: n, description: registry[n].description, builtin: registry[n].builtin };
      });
    }

    function instantiate(name, opts) {
      var t = registry[name];
      if (!t) throw new Error("no template named '" + name + "' — see list()");
      opts = opts || {};
      var os = oceanicFactory({ manual: true, name: "tpl-" + name, now: opts.now, storage: opts.storage });
      os.start();
      var ctx = { oceanic: os, core: C, options: opts, parts: {} };
      var seeded;
      try { seeded = t.setup(ctx) || {}; }
      catch (e) {
        throw new Error("template '" + name + "' failed to instantiate: " + (e && e.message ? e.message : e));
      }
      return { template: name, description: t.description, oceanic: os, parts: ctx.parts, seeded: seeded };
    }

    /* ---------------- built-ins ---------------- */

    register("research-workspace", { _builtin: true,
      description: "a team investigating a question — identity, a workspace, a first verified observation, and the shared-knowledge lens over it",
      setup: function (ctx) {
        var os = ctx.oceanic;
        var I = needFactory("createIdentity")({ oceanic: os });
        I.register({ name: "Lead", role: "steward", id: "lead" });
        I.register({ name: "Researcher One", id: "researcher-one" });
        var W = needFactory("createWorkspaces")({ oceanic: os, identity: I });
        W.create({ name: "Inquiry", purpose: "the question under investigation" });
        W.add("inquiry", "lead", "lead");
        W.add("inquiry", "researcher-one", "member");
        var o = os.reality.observe({ observation: "the founding question: what do we actually know?", source: "lead" });
        os.reality.verify(o.meta.oid);
        W.link("inquiry", { kind: "observation", id: o.meta.oid });
        var SK = needFactory("createSharedKnowledge")({ oceanic: os, workspaces: W });
        ctx.parts = { identity: I, workspaces: W, sharedKnowledge: SK };
        return { actors: 2, workspaces: 1, gathered: SK.knows("inquiry").length };
      }
    });

    register("ops-watch", { _builtin: true,
      description: "an operated system — logger, monitor and a CI/CD whose verify step refuses until real verification is wired in",
      setup: function (ctx) {
        var os = ctx.oceanic;
        var log = needFactory("createLogger")({ now: ctx.options.now });
        var M = needFactory("createMonitor")({ oceanic: os, logger: log, thresholds: ctx.options.thresholds });
        var verify = ctx.options.verify || function () {
          throw new Error("no verification wired — connect Continuous Verification before releasing (a template must not fake a green light)");
        };
        var R = needFactory("createCICD")({ oceanic: os, monitor: M, verify: verify, logger: log });
        var o = os.reality.observe({ observation: "the watch begins", source: "ops" });
        os.reality.verify(o.meta.oid);
        ctx.parts = { logger: log, monitor: M, cicd: R };
        return { checks: M.checks().length, releases: 0 };
      }
    });

    register("governance-body", { _builtin: true,
      description: "a deliberative body — a chair (steward), two members, and Governance with a two-endorsement quorum, ready to propose → review → ratify",
      setup: function (ctx) {
        var os = ctx.oceanic;
        var I = needFactory("createIdentity")({ oceanic: os });
        I.register({ name: "Chair", role: "steward", id: "chair" });
        I.register({ name: "Member One", id: "member-one" });
        I.register({ name: "Member Two", id: "member-two" });
        var G = needFactory("createGovernance")({ oceanic: os, identity: I, quorum: 2 });
        ctx.parts = { identity: I, governance: G };
        return { actors: 3, quorum: 2 };
      }
    });

    return { register: register, list: list, instantiate: instantiate };
  }

  return createTemplates;
});
