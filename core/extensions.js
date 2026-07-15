/*
 * Ω∞ OceanicOS :: Extensions
 * Build 0027 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * The last Application of Stage 3: the system opens to code it did not ship
 * with — SAFELY. createExtensions() is an extension host. An extension is a
 * plain manifest { id, name, version, activate(context) }; activation hands it
 * a CONTEXT, not the system: the context exposes only the API (0017) and a
 * namespaced log. The engines, the memory, the kernel are not reachable
 * through it — so the Charter binds an extension exactly as it binds a human,
 * the CLI, the agent: it cannot commit on unverified reality.
 *
 * Host guarantees, regardless of what an extension does:
 *   - validated    → register() refuses a manifest without id/name/activate,
 *                    with an invalid SemVer, or with a duplicate id.
 *   - contained    → an extension that throws on activate is marked FAILED
 *                    with its error recorded; the host never throws and other
 *                    extensions are untouched.
 *   - contributory → an active extension may contribute commands; the host
 *                    aggregates them into one palette; invoke() runs one and
 *                    reports { ok, data | error } — a throwing command is
 *                    caught like a failing shell command.
 *   - reversible   → deactivate() withdraws the contributions; reactivation
 *                    is allowed. States: registered → active | failed,
 *                    active ⇄ inactive.
 *
 * Ships with a sample, createExtensions.samples.tideWatch, the way the Agent
 * (0021) ships policies. extensions.html is the manager screen.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createExtensions = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "0.27.0";

  function createExtensions(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || typeof os.start !== "function" || !os.status) {
      throw new TypeError("createExtensions requires an assembled OceanicOS: createExtensions({ oceanic })");
    }
    var D = options.deps || (root && root.OceanicCore) || {};
    function need(fn, what) { if (typeof fn !== "function") throw new Error("createExtensions: " + what + " factory is unavailable — load the Core scripts or pass { deps }"); return fn; }

    var logger = options.logger || need(D.createLogger, "logger")({ now: options.now, minLevel: "info" });
    var api    = options.api    || need(D.createAPI, "api")({ oceanic: os });
    var semver = options.versioning || D.versioning;
    if (!semver || typeof semver.valid !== "function") throw new Error("createExtensions: versioning utility is unavailable — load core/versioning.js or pass { versioning }");

    var exts = {};      // id → { manifest, state, error, commands }
    var order = [];     // registration order
    var booted = false;

    function boot() {
      if (booted) return status();
      var b = os.start();
      booted = true;
      logger.info("extensions host online — OceanicOS v" + os.version + " booted on pulse " + b.pulse);
      return status();
    }

    function register(manifest) {
      var m = manifest || {};
      if (!m.id || typeof m.id !== "string")        return { ok: false, error: "an extension needs a string id" };
      if (!m.name || typeof m.name !== "string")    return { ok: false, error: "an extension needs a name" };
      if (typeof m.activate !== "function")         return { ok: false, error: "an extension needs an activate(context) function" };
      if (!semver.valid(m.version))                 return { ok: false, error: "'" + m.version + "' is not a valid SemVer version" };
      if (exts[m.id])                               return { ok: false, error: "extension '" + m.id + "' is already registered" };
      exts[m.id] = { manifest: m, state: "registered", error: null, commands: {} };
      order.push(m.id);
      logger.info("extension registered: " + m.id + "@" + m.version);
      return { ok: true, extension: shape(m.id) };
    }

    // the context is the WHOLE surface an extension gets: the API and a log.
    function contextFor(id) {
      return {
        api: api,
        log: function (message) { logger.info("[ext:" + id + "] " + String(message)); }
      };
    }

    function activate(id) {
      var e = exts[id];
      if (!e) return { ok: false, error: "no such extension '" + id + "'" };
      if (e.state === "active") return { ok: true, extension: shape(id) };
      try {
        var out = e.manifest.activate(contextFor(id)) || {};
        e.commands = {};
        var cmds = out.commands || {};
        for (var name in cmds) if (typeof cmds[name] === "function") e.commands[name] = cmds[name];
        e.state = "active";
        e.error = null;
        logger.info("extension activated: " + id + " (" + Object.keys(e.commands).length + " commands)");
        return { ok: true, extension: shape(id) };
      } catch (err) {
        e.state = "failed";
        e.error = String(err && err.message ? err.message : err);
        e.commands = {};
        logger.error("extension failed: " + id + " — " + e.error);
        return { ok: false, error: e.error, extension: shape(id) };
      }
    }

    function deactivate(id) {
      var e = exts[id];
      if (!e) return { ok: false, error: "no such extension '" + id + "'" };
      if (e.state !== "active") return { ok: false, error: "extension '" + id + "' is not active" };
      if (typeof e.manifest.deactivate === "function") {
        try { e.manifest.deactivate(); } catch (err) { logger.warn("extension '" + id + "' threw on deactivate — withdrawn anyway"); }
      }
      e.state = "inactive";
      e.commands = {};
      logger.info("extension deactivated: " + id);
      return { ok: true, extension: shape(id) };
    }

    function commands() {
      var palette = [];
      order.forEach(function (id) {
        var e = exts[id];
        if (e.state !== "active") return;
        Object.keys(e.commands).forEach(function (name) { palette.push({ extension: id, command: name }); });
      });
      return palette;
    }

    function invoke(id, command, params) {
      var e = exts[id];
      if (!e) return { ok: false, error: "no such extension '" + id + "'" };
      if (e.state !== "active") return { ok: false, error: "extension '" + id + "' is not active" };
      var fn = e.commands[command];
      if (!fn) return { ok: false, error: "extension '" + id + "' has no command '" + command + "'" };
      try {
        var data = fn(params || {});
        logger.info("ext command: " + id + "." + command);
        return { ok: true, extension: id, command: command, data: data };
      } catch (err) {
        var msg = String(err && err.message ? err.message : err);
        logger.warn("ext command failed: " + id + "." + command + " — " + msg);
        return { ok: false, extension: id, command: command, error: msg };
      }
    }

    function shape(id) {
      var e = exts[id];
      return { id: e.manifest.id, name: e.manifest.name, version: e.manifest.version,
               state: e.state, error: e.error, commands: Object.keys(e.commands).sort() };
    }

    function list() { return order.map(shape); }

    function status() {
      var active = 0; order.forEach(function (id) { if (exts[id].state === "active") active += 1; });
      return { version: VERSION, booted: booted, registered: order.length, active: active, commands: commands().length };
    }

    return {
      version: VERSION,
      boot: boot, register: register, activate: activate, deactivate: deactivate,
      invoke: invoke, commands: commands, list: list, status: status,
      oceanic: os, api: api, logger: logger
    };
  }

  // ---- sample extension, the way the Agent ships policies ----
  createExtensions.samples = {
    tideWatch: {
      id: "tide-watch", name: "Tide Watch", version: "1.0.0",
      activate: function (ctx) {
        ctx.log("watching the tide");
        return { commands: {
          pending: function () {
            var r = ctx.api.call("reality.list", { status: "pending" });
            return r.ok ? { pending: r.data.length, ids: r.data.map(function (o) { return o.id; }) } : { error: r.error };
          },
          mark: function (params) {
            var r = ctx.api.call("reality.observe", { observation: (params && params.text) || "tide checked", source: "ext:tide-watch" });
            return r.ok ? r.data : { error: r.error };
          }
        } };
      }
    }
  };

  createExtensions.VERSION = VERSION;
  return createExtensions;
});
