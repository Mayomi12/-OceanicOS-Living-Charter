/*
 * Ω∞ OceanicOS :: Harbor
 * Build 0019 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * The first Application. Stage 2 built the parts a program uses — the Kernel,
 * the CLI, the API, the Logger. The Harbor is the thing a PERSON uses: one
 * screen that boots a live OceanicOS, drives it by console, and shows its state
 * as a dashboard with a running activity feed.
 *
 * As with the CLI, the application LOGIC is separated from the screen so it can
 * be verified: createHarbor() is a controller / view-model. It owns a running
 * system (Kernel), an API (0017), a CLI (0012), and a Logger (0014), and turns
 * them into three testable things:
 *   - exec(line)   → run a command, record it in the transcript, log it,
 *                    and return the fresh dashboard. Never throws.
 *   - dashboard()  → a plain snapshot for rendering (pulse, ocean, per-engine
 *                    counts, recent activity).
 *   - resources()  → the harbor's navigation (Charter, Docs, Verification).
 * harbor.html is only the shell that draws these.
 *
 * Dependencies (API/CLI/Logger factories) resolve from the OceanicCore namespace
 * the Core scripts populate; pass createHarbor({ oceanic, deps }) to inject them.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createHarbor = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "0.19.0";

  function createHarbor(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || typeof os.start !== "function" || !os.status) {
      throw new TypeError("createHarbor requires an assembled OceanicOS: createHarbor({ oceanic })");
    }
    var D = options.deps || (root && root.OceanicCore) || {};
    function need(fn, what) { if (typeof fn !== "function") throw new Error("createHarbor: " + what + " factory is unavailable — load the Core scripts or pass { deps }"); return fn; }

    var logger = options.logger || need(D.createLogger, "logger")({ now: options.now, minLevel: "info" });
    var api    = options.api    || need(D.createAPI, "api")({ oceanic: os });
    var cli    = options.cli    || need(D.createCLI, "cli")({ oceanic: os });

    var transcript = [];
    var booted = false;

    function boot() {
      if (booted) return dashboard();
      var b = os.start();
      booted = true;
      logger.info("harbor online — OceanicOS v" + os.version + " booted on pulse " + b.pulse);
      return dashboard();
    }

    function exec(line) {
      var text = String(line == null ? "" : line).trim();
      var r = cli.exec(text);
      transcript.push({ line: text, ok: r.ok, message: r.ok ? r.message : r.error, at: r && r.data && r.data.at || null });
      if (text) {
        if (r.ok) logger.info("$ " + text);
        else logger.warn("$ " + text + " — " + r.error);
      }
      return { ok: r.ok, command: r.command, message: r.ok ? r.message : "", error: r.ok ? null : r.error, dashboard: dashboard() };
    }

    function shapeLog(e) { return { at: e.at, level: e.level, message: e.message }; }

    function dashboard() {
      var s = os.status();
      return {
        version: VERSION,
        systemVersion: s.version,
        booted: booted,
        pulse: s.pulse,
        ocean: s.memory.count,
        engines: {
          reality:   { verified: s.reality.verified, pending: s.reality.pending, rejected: s.reality.rejected, archived: s.reality.archived, total: s.reality.total },
          decisions: { decided: s.decisions.decided, open: s.decisions.open, rejected: s.decisions.rejected, reversed: s.decisions.reversed, total: s.decisions.total },
          knowledge: { established: s.knowledge.established, deprecated: s.knowledge.deprecated, topics: s.knowledge.topics, total: s.knowledge.total },
          projects:  { active: s.projects.active, completed: s.projects.completed, abandoned: s.projects.abandoned, total: s.projects.total },
          builds:    { count: s.builds.builds, latest: s.builds.latestNumber }
        },
        activity: logger.recent(8).map(shapeLog)
      };
    }

    function resources() {
      return [
        { label: "Charter",                 href: "../Ω∞ OceanicOS Living Charter.md", icon: "📜" },
        { label: "Documentation",           href: "docs.html",                          icon: "📚" },
        { label: "Continuous Verification", href: "verify-all.html",                    icon: "✅" },
        { label: "Build Log",               href: "../BUILD_LOG.md",                    icon: "📖" }
      ];
    }

    function status() {
      return { version: VERSION, booted: booted, commands: transcript.length, operations: api.operations().length };
    }

    return {
      version: VERSION,
      boot: boot, exec: exec, dashboard: dashboard, resources: resources,
      transcript: function () { return transcript.slice(); },
      help: function () { return cli.help(); },
      status: status,
      oceanic: os, api: api, cli: cli, logger: logger
    };
  }

  createHarbor.VERSION = VERSION;
  return createHarbor;
});
