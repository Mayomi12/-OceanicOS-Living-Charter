/*
 * Ω∞ OceanicOS :: Planning
 * Build 0031 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * The fourth Intelligence capability: a planner whose every promise is
 * checkable. createPlanner() turns a goal into a dependency-aware step graph
 * and keeps it honest:
 *
 *   - acyclic     → compose() refuses a cyclic plan and SPELLS OUT a cycle.
 *   - ordered     → order() is a deterministic topological order
 *                   (declaration order breaks ties).
 *   - grounded    → a step may cite observations as grounds; it becomes
 *                   executable only when they are VERIFIED. Verification
 *                   before action — with decidable freshness, so a
 *                   just-verified ground admits its step immediately.
 *   - prioritized → next() is the frontier, ranked by the Charter's own
 *                   doctrine (Article V §2 — the smallest drop that opens
 *                   the most future currents): each ready step carries
 *                   `opens`, the count of steps that transitively depend on
 *                   it, and the frontier sorts by it. The 1s Possibility
 *                   Engine, made computable.
 *   - honest      → only a frontier step may complete; a refusal names the
 *                   unmet dependency or the unverified ground. Progress is
 *                   exact. Planning writes NOTHING to the ocean.
 *
 * planner.html is the screen.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createPlanner = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "0.31.0";

  function createPlanner(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || typeof os.start !== "function" || !os.status) {
      throw new TypeError("createPlanner requires an assembled OceanicOS: createPlanner({ oceanic })");
    }
    var D = options.deps || (root && root.OceanicCore) || {};
    function need(fn, what) { if (typeof fn !== "function") throw new Error("createPlanner: " + what + " factory is unavailable — load the Core scripts or pass { deps }"); return fn; }
    var logger = options.logger || need(D.createLogger, "logger")({ now: options.now, minLevel: "info" });

    var plansById = {};
    var order_ = [];
    var nextPid = 0;
    var booted = false;

    function boot() {
      if (booted) return status();
      var b = os.start();
      booted = true;
      logger.info("planner online — OceanicOS v" + os.version + " booted on pulse " + b.pulse);
      return status();
    }

    function obsStatus(id) {
      var found = null;
      os.reality.observations(false).forEach(function (r) { if (r.meta.oid === id) found = r.meta.status; });
      return found;   // null = not a record of this ocean
    }

    // Kahn's algorithm; on failure, walk needs from a stuck step to name a cycle.
    function toposort(steps) {
      var byId = {}, indeg = {}, dependents = {};
      steps.forEach(function (s) { byId[s.id] = s; indeg[s.id] = 0; dependents[s.id] = []; });
      steps.forEach(function (s) {
        s.needs.forEach(function (n) { indeg[s.id] += 1; dependents[n].push(s.id); });
      });
      var ready = steps.filter(function (s) { return indeg[s.id] === 0; }).map(function (s) { return s.id; });
      var out = [];
      while (ready.length) {
        var id = ready.shift();                       // FIFO keeps declaration order among ties
        out.push(id);
        dependents[id].forEach(function (d) {
          indeg[d] -= 1;
          if (indeg[d] === 0) ready.push(d);
        });
      }
      if (out.length === steps.length) return { ok: true, order: out };
      // name a cycle: from any unplaced step, follow unmet needs until a repeat
      var stuck = steps.filter(function (s) { return out.indexOf(s.id) < 0; })[0];
      var seen = [], cur = stuck.id;
      while (seen.indexOf(cur) < 0) {
        seen.push(cur);
        cur = byId[cur].needs.filter(function (n) { return out.indexOf(n) < 0; })[0];
      }
      var cycle = seen.slice(seen.indexOf(cur)).concat(cur);
      return { ok: false, cycle: cycle };
    }

    function compose(goal, steps) {
      var g = String(goal == null ? "" : goal).trim();
      if (!g) return { ok: false, error: "a plan needs a goal" };
      if (!steps || !steps.length) return { ok: false, error: "a plan needs at least one step" };
      var shaped = [], ids = {};
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i] || {};
        if (!s.id || typeof s.id !== "string") return { ok: false, error: "step " + (i + 1) + " needs a string id" };
        if (ids[s.id]) return { ok: false, error: "duplicate step id '" + s.id + "'" };
        ids[s.id] = 1;
        shaped.push({ id: s.id, title: String(s.title || s.id), needs: (s.needs || []).slice(), grounds: (s.grounds || []).slice(), done: false });
      }
      for (var j = 0; j < shaped.length; j++) {
        for (var k = 0; k < shaped[j].needs.length; k++) {
          if (!ids[shaped[j].needs[k]]) return { ok: false, error: "step '" + shaped[j].id + "' needs unknown step '" + shaped[j].needs[k] + "'" };
        }
      }
      var t = toposort(shaped);
      if (!t.ok) return { ok: false, error: "the plan has a cycle: " + t.cycle.join(" → ") };
      var pid = "plan-" + (++nextPid);
      plansById[pid] = { pid: pid, goal: g, steps: shaped, topo: t.order };
      order_.push(pid);
      logger.info("plan composed: " + pid + " — " + g + " (" + shaped.length + " steps)");
      return { ok: true, plan: shapePlan(plansById[pid]) };
    }

    // transitive dependents count — how many future steps completing this one opens
    function opensCount(p, id) {
      var dependents = {};
      p.steps.forEach(function (s) { dependents[s.id] = []; });
      p.steps.forEach(function (s) { s.needs.forEach(function (n) { dependents[n].push(s.id); }); });
      var seen = {}, queue = dependents[id].slice(), count = 0;
      while (queue.length) {
        var cur = queue.shift();
        if (seen[cur]) continue;
        seen[cur] = 1; count += 1;
        queue = queue.concat(dependents[cur]);
      }
      return count;
    }

    function stepState(p, s) {
      if (s.done) return { state: "done" };
      var doneIds = {};
      p.steps.forEach(function (x) { if (x.done) doneIds[x.id] = 1; });
      var unmet = s.needs.filter(function (n) { return !doneIds[n]; });
      if (unmet.length) return { state: "blocked-by-deps", unmet: unmet };
      var unverified = s.grounds.filter(function (g) { return obsStatus(g) !== "verified"; });
      if (unverified.length) return { state: "blocked-by-reality", unverified: unverified };
      return { state: "ready" };
    }

    function withPlan(pid, fn) {
      var p = plansById[pid];
      if (!p) return { ok: false, error: "no such plan '" + pid + "'" };
      return fn(p);
    }

    function next(pid) {
      var p = plansById[pid];
      if (!p) return [];
      return p.steps
        .filter(function (s) { return stepState(p, s).state === "ready"; })
        .map(function (s) { return { id: s.id, title: s.title, opens: opensCount(p, s.id) }; })
        .sort(function (a, b) { return b.opens - a.opens; });
    }

    function complete(pid, stepId) {
      return withPlan(pid, function (p) {
        var s = null;
        p.steps.forEach(function (x) { if (x.id === stepId) s = x; });
        if (!s) return { ok: false, error: "no such step '" + stepId + "' in " + pid };
        var st = stepState(p, s);
        if (st.state === "done") return { ok: false, error: "step '" + stepId + "' is already complete" };
        if (st.state === "blocked-by-deps") return { ok: false, error: "step '" + stepId + "' waits on unmet steps: " + st.unmet.join(", ") };
        if (st.state === "blocked-by-reality") return { ok: false, error: "step '" + stepId + "' waits on unverified reality: " + st.unverified.join(", ") };
        s.done = true;
        logger.info("plan step complete: " + pid + " / " + stepId);
        return { ok: true, progress: progress(pid) };
      });
    }

    function progress(pid) {
      var p = plansById[pid];
      if (!p) return { done: 0, total: 0, percent: 0, complete: false };
      var done = p.steps.filter(function (s) { return s.done; }).length;
      var total = p.steps.length;
      return { done: done, total: total, percent: Math.round(100 * done / total), complete: done === total };
    }

    function shapeStep(p, s) {
      var st = stepState(p, s);
      return { id: s.id, title: s.title, needs: s.needs.slice(), grounds: s.grounds.slice(),
               done: s.done, state: st.state, opens: opensCount(p, s.id),
               unmet: (st.unmet || []).slice(), unverified: (st.unverified || []).slice() };
    }
    function shapePlan(p) {
      return { pid: p.pid, goal: p.goal, steps: p.steps.map(function (s) { return shapeStep(p, s); }),
               progress: progress(p.pid) };
    }

    function plan(pid) { var p = plansById[pid]; return p ? shapePlan(p) : null; }
    function order(pid) { var p = plansById[pid]; return p ? p.topo.slice() : []; }
    function plans() { return order_.map(function (pid) { return shapePlan(plansById[pid]); }); }

    function status() {
      var total = 0, done = 0;
      order_.forEach(function (pid) { var pr = progress(pid); total += pr.total; done += pr.done; });
      return { version: VERSION, booted: booted, plans: order_.length, steps: total, done: done };
    }

    return {
      version: VERSION,
      boot: boot, compose: compose, order: order, next: next, complete: complete,
      progress: progress, plan: plan, plans: plans, status: status,
      oceanic: os, logger: logger
    };
  }

  createPlanner.VERSION = VERSION;
  return createPlanner;
});
