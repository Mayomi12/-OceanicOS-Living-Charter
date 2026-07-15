/*
 * Ω∞ OceanicOS :: Maintenance
 * Build 0061 · Stage 8 (Stewardship) · zero-runtime (plain browser or any JS engine)
 *
 * Systems do not stay healthy — they are KEPT healthy. Maintenance is the
 * steward's standing chore list: one derived, prioritized upkeep sweep across
 * everything this system knows how to neglect, composing the watchers that
 * already exist instead of inventing new ones:
 *
 *   priority 1 — REPAIR      unsound/broken records (the Planner 0029's list)
 *                DAMAGE      archives on the shelf whose fixity broke (0059)
 *   priority 2 — RECONFIRM   records resting on drifted ground (Planner)
 *   priority 3 — VERDICTS    pending observations awaiting a verdict (Planner)
 *                STALLED     governance proposals open past their welcome (0043)
 *   priority 4 — CAUTIONS    the Monitor's warnings (0047) — visible risks
 *
 *   chores({ shelf? })  → the prioritized list, each { priority, kind, target,
 *                         reason } — ADVISORY: it writes nothing; stewards act
 *   sweep({ shelf? })   → the same sweep, with its summary written to the
 *                         operational log (info when clear, warn when not)
 *   status()            → counts by priority and kind
 *
 * "Nothing to do" is a real answer and the sweep says it plainly. Thresholds
 * (how old is stale?) are configurable and time is injectable, so a steward's
 * standards are policy, not accident.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createMaintenance = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function createMaintenance(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || !os.memory || !os.reality) {
      throw new TypeError("createMaintenance requires an assembled OceanicOS: createMaintenance({ oceanic })");
    }
    var C = (root && root.OceanicCore) || {};
    function need(fn, made, what) {
      if (made) return made;
      if (typeof fn === "function") return fn({ oceanic: os });
      throw new Error("createMaintenance needs " + what + " — load its module first, or pass it in");
    }
    var planner = need(C.createPlanner, options.planner, "the Planner (core/plan.js)");
    var monitor = options.monitor || null;           // optional — its absence is the Monitor's own business (SEC-GATE)
    var preservation = options.preservation ||
      (typeof C.createPreservation === "function" ? C.createPreservation() : null);
    var logger = options.logger || null;
    var now = options.now || function () { return Date.now(); };
    var t = options.thresholds || {};
    var staleProposalMs = typeof t.staleProposalMs === "number" ? t.staleProposalMs : 7 * 24 * 3600 * 1000;

    function chores(opts) {
      opts = opts || {};
      var list = [];

      // the Planner's reality upkeep — repair (1), reconfirm (2), verdicts (3)
      planner.plan().steps.forEach(function (s) {
        list.push({
          priority: s.priority,
          kind: s.priority === 1 ? "repair" : s.priority === 2 ? "reconfirm" : "verdict",
          target: s.targetType + " " + s.target,
          reason: s.reason
        });
      });

      // the shelf — damaged archives are priority-1 repairs
      if (opts.shelf && opts.shelf.length) {
        if (!preservation) throw new Error("a shelf was offered but Preservation (core/preservation.js) is not loaded");
        preservation.audit(opts.shelf).results.forEach(function (r) {
          if (!r.intact) {
            list.push({ priority: 1, kind: "archive-damage",
                        target: "archive " + (r.label || ("#" + (r.index + 1))),
                        reason: r.detail + " — restore from a good copy or re-seal from a live ocean" });
          }
        });
      }

      // stalled governance — proposals open past their welcome
      os.memory.recall({ type: "proposal" }).forEach(function (p) {
        var st = p.meta.status;
        if (st !== "proposed" && st !== "under-review") return;
        if (now() - p.at < staleProposalMs) return;
        list.push({ priority: 3, kind: "stalled-proposal",
                    target: "proposal " + p.meta.pid,
                    reason: "open since " + p.at + " (" + st + ") — review it, ratify it, or withdraw it; a stalled change is a quiet no" });
      });

      // the Monitor's cautions — visible risks worth a look
      if (monitor) {
        monitor.checks().forEach(function (c) {
          if (c.verdict === "warn") {
            list.push({ priority: 4, kind: "caution", target: "check " + c.id, reason: c.detail });
          }
        });
      }

      list.sort(function (a, b) {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.target < b.target ? -1 : a.target > b.target ? 1 : 0;
      });
      list.forEach(function (c, i) { c.order = i + 1; });
      return list;
    }

    function sweep(opts) {
      var list = chores(opts);
      var byPriority = {};
      list.forEach(function (c) { byPriority[c.priority] = (byPriority[c.priority] || 0) + 1; });
      var headline = list.length === 0
        ? "NOTHING TO DO — the system is kept" // a real answer
        : list.length + " chore(s): " + [1, 2, 3, 4].map(function (p) {
            return byPriority[p] ? "P" + p + "×" + byPriority[p] : null;
          }).filter(Boolean).join(", ") + " — start with: " + list[0].kind + " " + list[0].target;
      if (logger) {
        try { logger[list.length === 0 ? "info" : "warn"]("maintenance: " + headline, { chores: list.length }); } catch (e) {}
      }
      return { chores: list, total: list.length, byPriority: byPriority, clear: list.length === 0, headline: headline };
    }

    function status() {
      var list = chores({}); // a quiet read — no log entry, unlike sweep()
      var byPriority = {}, byKind = {};
      list.forEach(function (c) {
        byPriority[c.priority] = (byPriority[c.priority] || 0) + 1;
        byKind[c.kind] = (byKind[c.kind] || 0) + 1;
      });
      return { chores: list.length, clear: list.length === 0, byPriority: byPriority, byKind: byKind };
    }

    return { chores: chores, sweep: sweep, status: status };
  }

  return createMaintenance;
});
