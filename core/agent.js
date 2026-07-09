/*
 * Ω∞ OceanicOS :: AI Agent
 * Build 0021 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * The build loop, made autonomous — safely. An Agent drives OceanicOS through a
 * perceive → decide → act cycle over the API (0017). It carries no "magic": the
 * INTELLIGENCE lives in a pluggable policy function; the Agent is the safe
 * RUNNER around it. That separation is the whole point — a policy can be as
 * simple as a scripted queue or as clever as you like, but the runner's
 * guarantees never change:
 *
 *   - BOUNDED. run({ maxSteps }) always terminates — an agent can never loop
 *     forever.
 *   - HONEST. Every action is an API call, so the Charter's rules (verification
 *     before acceptance, append-only) bind the agent exactly as they bind a
 *     human. An agent cannot do what the API forbids.
 *   - HALTING. A failed action stops the run — an agent does not barrel on past
 *     a refusal.
 *   - ACCOUNTABLE. Every step is recorded in an immutable trace and logged, so
 *     what an agent did is always reviewable. It never throws.
 *
 * policy(perception, memory) → { op, params } | { done: true }
 *   perception is a read-only snapshot; memory is a plain object the agent
 *   carries across steps for the policy's own use.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createAgent = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
    }
    return obj;
  }

  function createAgent(options) {
    options = options || {};
    var api = options.api;
    if (!api || typeof api.call !== "function" || typeof api.describe !== "function") {
      throw new TypeError("createAgent requires an OceanicOS API: createAgent({ api, policy })");
    }
    var policy = options.policy;
    if (typeof policy !== "function") throw new TypeError("createAgent requires a policy function: policy(perception, memory) → { op, params } | { done: true }");
    var logger = options.logger || null;
    if (logger && typeof logger.info !== "function") throw new TypeError("createAgent: logger, if provided, must be a Logger");
    var name = options.name || "agent";
    var goal = options.goal || null;

    var memory = {};      // the agent's own scratch space, carried across steps
    var trace = [];
    var stepNo = 0;
    var finished = false;

    function log(level, message) { if (logger) try { logger[level](message); } catch (e) {} }

    // a read-only snapshot the policy decides from
    function perceive() {
      return {
        step: stepNo,
        status: api.call("system.status").data,
        pending: api.call("reality.list", { status: "pending" }).data || [],
        openDecisions: api.call("decision.list", { status: "open" }).data || []
      };
    }

    function step() {
      if (finished) return { done: true, reason: "already finished" };
      stepNo += 1;
      var perception = perceive();
      var action;
      try { action = policy(perception, memory); }
      catch (e) {
        var perr = { step: stepNo, op: null, params: null, ok: false, error: "policy error: " + (e && e.message ? e.message : e) };
        trace.push(perr); finished = true;
        log("error", name + " · policy threw at step " + stepNo + " — " + perr.error);
        return { done: true, halted: true, entry: perr };
      }
      if (!action || action.done) {
        finished = true;
        log("info", name + " · done at step " + stepNo);
        return { done: true, halted: false };
      }
      if (typeof action.op !== "string") {
        var berr = { step: stepNo, op: null, params: action.params || null, ok: false, error: "policy returned an action with no op" };
        trace.push(berr); finished = true;
        log("error", name + " · " + berr.error);
        return { done: true, halted: true, entry: berr };
      }
      var result = api.call(action.op, action.params || {});
      var entry = { step: stepNo, op: action.op, params: action.params || {}, ok: result.ok, data: result.ok ? result.data : null, error: result.ok ? null : result.error };
      trace.push(entry);
      if (result.ok) log("info", name + " · " + action.op + " ✓");
      else { log("warn", name + " · " + action.op + " ✗ — " + result.error); finished = true; }
      return { done: false, halted: !result.ok, entry: entry };
    }

    function run(runOptions) {
      runOptions = runOptions || {};
      var maxSteps = (typeof runOptions.maxSteps === "number" && runOptions.maxSteps > 0) ? runOptions.maxSteps : 50;
      var startedAt = trace.length;
      var halted = false, reachedLimit = false, count = 0;
      log("info", name + " · run start" + (goal ? " — goal: " + goal : ""));
      while (!finished) {
        if (count >= maxSteps) { reachedLimit = true; break; }
        var r = step();
        count += 1;
        if (r.halted) { halted = true; break; }
        if (r.done) break;
      }
      var acted = trace.slice(startedAt);
      var failed = acted.filter(function (e) { return !e.ok; }).length;
      return deepFreeze({
        name: name, goal: goal,
        completed: finished && !halted && !reachedLimit,
        halted: halted,
        reachedLimit: reachedLimit,
        steps: acted.length,
        succeeded: acted.length - failed,
        failed: failed,
        trace: acted
      });
    }

    function getTrace() { return trace.slice(); }

    return { name: name, goal: goal, step: step, run: run, perceive: perceive, trace: getTrace,
             memory: function () { return memory; } };
  }

  // ---- built-in policies: the runner is generic; these are just data ----
  createAgent.policies = {
    // run a fixed script of actions, in order, then stop
    queue: function (actions) {
      var list = (actions || []).slice();
      return function (perception, memory) {
        memory.i = memory.i || 0;
        if (memory.i >= list.length) return { done: true };
        return list[memory.i++];
      };
    },
    // reactive: verify the oldest pending observation each step until none remain
    verifyAllPending: function (note) {
      return function (perception) {
        var p = perception.pending[0];
        if (!p) return { done: true };
        return { op: "reality.verify", params: { id: p.id, note: note || "agent-verified" } };
      };
    }
  };

  return createAgent;
});
