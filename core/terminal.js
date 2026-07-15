/*
 * Ω∞ OceanicOS :: Terminal
 * Build 0026 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * The keyboard-native application. The CLI (0012) is a pure interpreter; the
 * Harbor gave it a small console pane. The Terminal elevates it to the whole
 * screen — and everything that makes a terminal more than an input box is
 * verifiable LOGIC, so it lives here, not in the page: readline-style history
 * recall, tab completion over the CLI's real verbs, and a scrollback
 * discipline. As with every application, createTerminal() is a view-model and
 * terminal.html is only the shell that draws it.
 *
 *   - run(line)        → execute through the CLI; scrollback gains the prompt
 *                        line and the result; history remembers; never throws.
 *   - recall(up|down)  → walk the history like readline (clamped at the
 *                        oldest, empty past the newest).
 *   - complete(prefix) → the CLI's own verbs, filtered; unique match completes
 *                        to "verb "; ambiguity extends to the shared prefix.
 *   - clear()          → clears the VIEW only. The Charter's no-erasure law
 *                        governs the Memory Ocean, not a screen: every record
 *                        captured through this terminal stays in the ocean.
 *
 * Dependencies (CLI/Logger factories) resolve from the OceanicCore namespace
 * the Core scripts populate; pass createTerminal({ oceanic, deps }) to inject.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createTerminal = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "0.26.0";

  function createTerminal(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || typeof os.start !== "function" || !os.status) {
      throw new TypeError("createTerminal requires an assembled OceanicOS: createTerminal({ oceanic })");
    }
    var D = options.deps || (root && root.OceanicCore) || {};
    function need(fn, what) { if (typeof fn !== "function") throw new Error("createTerminal: " + what + " factory is unavailable — load the Core scripts or pass { deps }"); return fn; }

    var logger = options.logger || need(D.createLogger, "logger")({ now: options.now, minLevel: "info" });
    var cli    = options.cli    || need(D.createCLI, "cli")({ oceanic: os });

    var lines = [];        // scrollback: { kind: "sys"|"cmd"|"out"|"err", text }
    var past = [];         // history, oldest first
    var cursor = -1;       // -1 = at the fresh prompt (nothing recalled)
    var ran = 0;
    var booted = false;

    function verbs() { return (cli.commands || []).slice(); }

    function write(kind, text) { lines.push({ kind: kind, text: String(text) }); }

    function boot() {
      if (booted) return status();
      var b = os.start();
      booted = true;
      write("sys", "ƆCEANiC_OS terminal v" + VERSION + " — system v" + os.version + " booted on pulse " + b.pulse + ". Type 'help'.");
      logger.info("terminal online — OceanicOS v" + os.version + " booted on pulse " + b.pulse);
      return status();
    }

    function run(line) {
      var text = String(line == null ? "" : line).trim();
      write("cmd", "oceanic> " + text);
      var r = cli.exec(text);
      if (r.ok) { if (r.message) write("out", r.message); }
      else write("err", "! " + r.error);
      if (text) {
        if (past[past.length - 1] !== text) past.push(text);   // consecutive duplicates stored once
        ran += 1;
        if (r.ok) logger.info("$ " + text);
        else logger.warn("$ " + text + " — " + r.error);
      }
      cursor = -1;                                             // a run resets recall
      return { ok: r.ok, command: r.command, message: r.ok ? r.message : "", error: r.ok ? null : r.error, output: r.ok ? r.message : r.error };
    }

    function recall(direction) {
      if (!past.length) return "";
      if (direction === "up") {
        if (cursor === -1) cursor = past.length - 1;
        else if (cursor > 0) cursor -= 1;                      // clamped at the oldest
        return past[cursor];
      }
      if (direction === "down") {
        if (cursor === -1) return "";
        cursor += 1;
        if (cursor >= past.length) { cursor = -1; return ""; } // past the newest = fresh prompt
        return past[cursor];
      }
      return "";
    }

    function sharedPrefix(list) {
      var p = list[0];
      for (var i = 1; i < list.length; i++) {
        while (list[i].indexOf(p) !== 0) p = p.slice(0, -1);
      }
      return p;
    }

    function complete(prefix) {
      var p = String(prefix == null ? "" : prefix);
      var matches = verbs().filter(function (v) { return v.indexOf(p) === 0; });
      if (!matches.length) return { matches: [], completion: p };
      if (matches.length === 1) return { matches: matches, completion: matches[0] + " " };
      return { matches: matches, completion: sharedPrefix(matches) };
    }

    function clear() {
      lines = [];                                              // the view only — the ocean keeps everything
      write("sys", "screen cleared — the ocean remembers (" + os.status().memory.count + " records).");
      return { ok: true };
    }

    function status() {
      return { version: VERSION, booted: booted, commands: ran, history: past.length, scrollback: lines.length };
    }

    return {
      version: VERSION,
      boot: boot, run: run, recall: recall, complete: complete, clear: clear,
      scrollback: function () { return lines.map(function (l) { return { kind: l.kind, text: l.text }; }); },
      history: function () { return past.slice(); },
      verbs: verbs,
      status: status,
      help: function () { return cli.help(); },
      oceanic: os, cli: cli, logger: logger
    };
  }

  createTerminal.VERSION = VERSION;
  return createTerminal;
});
