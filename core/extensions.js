/*
 * Ω∞ OceanicOS :: Extensions
 * Build 0022 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * The system learns new tricks without being rebuilt. An Extension is a small
 * plugin that, on install, is handed a controlled context — the running system,
 * the API, a log, and a provide() to register commands — and contributes named
 * commands the rest of the system (or an Agent, or the CLI) can then invoke.
 *
 * The registry keeps extensions honest and separable:
 *  - Commands are NAMESPACED by extension ("<ext>.<command>"), so two plugins
 *    can never silently clash.
 *  - install validates the plugin and is refused if the name is already taken.
 *  - command() dispatch NEVER throws — a plugin's error is caught and reported.
 *  - remove() cleanly withdraws an extension and all the commands it added.
 *
 * An extension is just: { name, version?, setup(ctx), teardown?(ctx) }.
 *   ctx = { oceanic, api, log(msg), provide(localName, handler) }
 *   a command handler is handler(args) → any value.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createExtensions = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function createExtensions(options) {
    options = options || {};
    var oceanic = options.oceanic;
    if (!oceanic || typeof oceanic.status !== "function") {
      throw new TypeError("createExtensions requires an assembled OceanicOS: createExtensions({ oceanic })");
    }
    var D = options.deps || (root && root.OceanicCore) || {};
    var api = options.api || (typeof D.createAPI === "function" ? D.createAPI({ oceanic: oceanic }) : null);
    var logger = options.logger || null;
    if (logger && typeof logger.info !== "function") throw new TypeError("createExtensions: logger, if provided, must be a Logger");

    var installed = {};   // name -> { ext, commands: [fullName...] }
    var commands = {};    // fullName -> { ext, handler }

    function log(level, msg) { if (logger) try { logger[level](msg); } catch (e) {} }

    function use(ext) {
      if (!ext || typeof ext !== "object") throw new TypeError("use requires an extension object");
      if (typeof ext.name !== "string" || !ext.name) throw new TypeError("an extension needs a non-empty string name");
      if (/[.\s]/.test(ext.name)) throw new TypeError("extension name must not contain '.' or whitespace: " + ext.name);
      if (typeof ext.setup !== "function") throw new TypeError("extension '" + ext.name + "' needs a setup(ctx) function");
      if (installed[ext.name]) throw new Error("extension already installed: " + ext.name);

      var provided = [];
      var ctx = {
        oceanic: oceanic,
        api: api,
        log: function (msg) { log("info", ext.name + " · " + msg); },
        provide: function (localName, handler) {
          if (typeof localName !== "string" || !localName) throw new TypeError("provide requires a command name");
          if (/[.\s]/.test(localName)) throw new TypeError("command name must not contain '.' or whitespace: " + localName);
          if (typeof handler !== "function") throw new TypeError("provide requires a handler function for " + localName);
          var full = ext.name + "." + localName;
          if (commands[full]) throw new Error("command already provided: " + full);
          commands[full] = { ext: ext.name, handler: handler };
          provided.push(full);
          return full;
        }
      };

      try { ext.setup(ctx); }
      catch (e) {
        // roll back any commands the failed setup managed to register — no half-installs
        provided.forEach(function (full) { delete commands[full]; });
        throw new Error("extension '" + ext.name + "' failed to install: " + (e && e.message ? e.message : e));
      }

      installed[ext.name] = { ext: ext, commands: provided, version: ext.version || null };
      log("info", "installed extension '" + ext.name + "' (" + provided.length + " command" + (provided.length === 1 ? "" : "s") + ")");
      return { name: ext.name, commands: provided.slice() };
    }

    function command(fullName, args) {
      var c = commands[fullName];
      if (!c) return { ok: false, command: fullName, data: null, error: "unknown command: " + fullName };
      try { return { ok: true, command: fullName, data: c.handler(args), error: null }; }
      catch (e) { return { ok: false, command: fullName, data: null, error: String(e && e.message ? e.message : e) }; }
    }

    function remove(name) {
      var rec = installed[name];
      if (!rec) throw new Error("no extension installed named " + name);
      if (typeof rec.ext.teardown === "function") {
        try { rec.ext.teardown({ oceanic: oceanic, api: api, log: function (m) { log("info", name + " · " + m); } }); }
        catch (e) { log("warn", "teardown of '" + name + "' threw: " + (e && e.message ? e.message : e)); }
      }
      rec.commands.forEach(function (full) { delete commands[full]; });
      delete installed[name];
      log("info", "removed extension '" + name + "'");
      return true;
    }

    function has(name) { return !!installed[name]; }
    function list() {
      return Object.keys(installed).map(function (n) {
        return { name: n, version: installed[n].version, commands: installed[n].commands.slice() };
      });
    }
    function commandNames() { return Object.keys(commands).slice().sort(); }
    function status() { return { extensions: Object.keys(installed).length, commands: Object.keys(commands).length }; }

    return { use: use, command: command, remove: remove, has: has, list: list, commands: commandNames, status: status };
  }

  // ---- example extensions: proof that new capabilities can just be plugged in ----
  createExtensions.examples = {
    // a trivial greeter — contributes one pure command
    greeter: {
      name: "greeter", version: "1.0.0",
      setup: function (ctx) {
        ctx.provide("hello", function (args) {
          var who = (args && args.who) || "harbor";
          return "Take a Drop, " + who + ".";
        });
      }
    },
    // a real capability plugin: "survey" observes a fact AND verifies it in one step,
    // driving the system only through the API it was handed
    surveyor: {
      name: "surveyor", version: "1.0.0",
      setup: function (ctx) {
        ctx.provide("survey", function (args) {
          if (!args || typeof args.fact !== "string" || !args.fact) throw new Error("survey requires { fact }");
          var obs = ctx.api.call("reality.observe", { observation: args.fact, source: "surveyor", evidence: args.evidence || null });
          if (!obs.ok) throw new Error(obs.error);
          var ver = ctx.api.call("reality.verify", { id: obs.data.id, note: args.note || "surveyed on site" });
          if (!ver.ok) throw new Error(ver.error);
          return { id: ver.data.id, status: ver.data.status, fact: args.fact };
        });
      }
    }
  };

  return createExtensions;
});
