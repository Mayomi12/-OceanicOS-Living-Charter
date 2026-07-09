/*
 * Ω∞ OceanicOS Core :: Projects Engine
 * Build 0010 · Stage 1 · zero-runtime (plain browser or any JS engine)
 *
 * The last thread of Stage 1 Core, and the one that gathers the others. Reality
 * (0007), Decisions (0008), and Knowledge (0009) each hold one kind of thing; a
 * Project is a named effort toward a goal that ties those threads together and
 * carries a lifecycle of its own.
 *
 * Composition, not reinvention: stored in a Core Memory (0005) — append-only,
 * provenance, optional persistence, for free. Projects is deliberately an
 * ORGANISATIONAL layer, not an epistemic one: it records the threads it has
 * gathered (an observation id, a decision id, a knowledge id, a build number,
 * or a plain note) as typed references. The truth of each referenced thing
 * lives in its own engine; the Project simply remembers that it belongs here.
 *
 * A project carries:
 *   Name · Goal · Links (typed references, append-only) · Source · Confidence · Status.
 *
 * The status machine, enforced in code:
 *   active → completed | abandoned      (both terminal)
 * Rules:
 *  - Birth state is always ACTIVE.
 *  - COMPLETED and ABANDONED are terminal — a closed project gathers no more.
 *  - link() only ever grows the record (no unlink) — nothing is erased. Each
 *    link is a Memory amendment, so the project's assembly is itself a history.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createProjectsEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var STATUS = ["active", "completed", "abandoned"];
  var LINK_KINDS = ["observation", "decision", "knowledge", "build", "note"];

  function createProjectsEngine(options) {
    options = options || {};
    var memory = options.memory;
    if (!memory || typeof memory.remember !== "function" || typeof memory.amend !== "function" || typeof memory.recall !== "function") {
      throw new TypeError("createProjectsEngine requires a Core Memory instance: createProjectsEngine({ memory })");
    }
    var now = options.now || function () { return Date.now(); };
    var pseq = 0;
    var pidgen = options.pidgen || function () {
      pseq += 1;
      return "p-" + pseq + "-" + Math.random().toString(16).slice(2, 8);
    };

    /* ---- reads ---- */
    function projects(includeSuperseded) {
      return memory.recall({ type: "project", includeSuperseded: !!includeSuperseded });
    }
    function current(pid) {
      var all = projects(false);
      for (var i = 0; i < all.length; i++) {
        if (all[i].meta && all[i].meta.pid === pid) return all[i];
      }
      return null;
    }
    function get(pid) { return current(pid); }
    function byStatus(status) {
      if (STATUS.indexOf(status) < 0) throw new TypeError("unknown status: " + status);
      return projects(false).filter(function (r) { return r.meta.status === status; });
    }
    function links(pid) {
      var rec = current(pid);
      if (!rec) throw new Error("no project with pid " + pid);
      return rec.meta.links.slice();
    }
    function history(pid) {
      return projects(true)
        .filter(function (r) { return r.meta && r.meta.pid === pid; })
        .sort(function (a, b) { return a.at - b.at; });
    }

    /* ---- writes ---- */
    function open(entry) {
      if (!entry || typeof entry.name !== "string" || !entry.name) {
        throw new TypeError("open requires an entry with a non-empty string name");
      }
      var pid = pidgen();
      return memory.remember({
        type: "project",
        body: entry.name,
        source: entry.source || null,
        confidence: entry.confidence || "medium",
        meta: {
          pid: pid,
          status: "active",
          goal: entry.goal || null,
          links: [],
          note: null
        }
      });
    }

    function link(pid, ref) {
      var rec = current(pid);
      if (!rec) throw new Error("no project with pid " + pid);
      if (rec.meta.status !== "active") throw new Error("project " + pid + " is " + rec.meta.status + " — a closed project gathers no more threads");
      if (!ref || typeof ref !== "object") throw new TypeError("link requires a reference: { kind, id }");
      if (LINK_KINDS.indexOf(ref.kind) < 0) throw new TypeError("link kind must be one of: " + LINK_KINDS.join(", "));
      if (typeof ref.id !== "string" || !ref.id) throw new TypeError("link requires a non-empty string id (for a note, the id IS the note text)");
      var entry = { kind: ref.kind, id: ref.id, label: ref.label || null, at: now() };
      var grown = rec.meta.links.slice();
      grown.push(entry);
      return memory.amend(rec.id, {
        type: "project",
        body: rec.body,
        source: rec.source,
        confidence: rec.confidence,
        meta: {
          pid: pid,
          status: rec.meta.status,
          goal: rec.meta.goal,
          links: grown,
          note: rec.meta.note
        }
      });
    }

    function close(pid, to, note) {
      var rec = current(pid);
      if (!rec) throw new Error("no project with pid " + pid);
      if (rec.meta.status !== "active") throw new Error("project " + pid + " is already " + rec.meta.status + " — it is closed");
      return memory.amend(rec.id, {
        type: "project",
        body: rec.body,
        source: rec.source,
        confidence: rec.confidence,
        meta: {
          pid: pid,
          status: to,
          goal: rec.meta.goal,
          links: rec.meta.links.slice(),
          note: note || null
        }
      });
    }
    function complete(pid, note) { return close(pid, "completed", note); }
    function abandon(pid, note) { return close(pid, "abandoned", note); }

    function status() {
      var all = projects(false);
      var counts = { active: 0, completed: 0, abandoned: 0 };
      var totalLinks = 0;
      for (var i = 0; i < all.length; i++) {
        counts[all[i].meta.status] += 1;
        totalLinks += all[i].meta.links.length;
      }
      return {
        total: all.length,
        active: counts.active,
        completed: counts.completed,
        abandoned: counts.abandoned,
        links: totalLinks
      };
    }

    return {
      open: open, link: link, complete: complete, abandon: abandon,
      get: get, byStatus: byStatus, links: links, projects: projects, history: history, status: status
    };
  }

  createProjectsEngine.STATUS = STATUS.slice();
  createProjectsEngine.LINK_KINDS = LINK_KINDS.slice();
  return createProjectsEngine;
});
