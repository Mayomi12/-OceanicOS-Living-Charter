/*
 * Ω∞ OceanicOS :: Terminal
 * Build 0023 · Stage 3 (Applications) · zero-runtime (plain browser or any JS engine)
 *
 * A real terminal for OceanicOS. The Harbor (0019) is a dashboard with a console
 * corner; the Terminal is the console taken seriously — scrollback, command
 * history you can walk with the arrow keys, and Tab completion. As everywhere,
 * the LOGIC is separated from the screen so it can be verified: createTerminal()
 * is a REPL controller; terminal.html is only the glass.
 *
 * It wraps the CLI (0012) and adds the ergonomics a terminal is expected to have:
 *   - submit(line)      run a command; append input + output to the scrollback.
 *                       Never throws (the CLI already reports errors).
 *   - historyPrev/Next  walk previously submitted commands, shell-style.
 *   - complete(partial) Tab completion over the command vocabulary.
 *   - built-ins clear / history that belong to the terminal, not the system.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createTerminal = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var BUILTINS = ["clear", "history"];

  function commonPrefix(strings) {
    if (!strings.length) return "";
    var p = strings[0];
    for (var i = 1; i < strings.length; i++) {
      var s = strings[i];
      var j = 0;
      while (j < p.length && j < s.length && p[j] === s[j]) j++;
      p = p.slice(0, j);
      if (!p) break;
    }
    return p;
  }

  function createTerminal(options) {
    options = options || {};
    var cli = options.cli;
    if (!cli) {
      var D = options.deps || (root && root.OceanicCore) || {};
      if (!options.oceanic || typeof D.createCLI !== "function") {
        throw new TypeError("createTerminal requires a CLI or an assembled OceanicOS: createTerminal({ cli }) or createTerminal({ oceanic })");
      }
      cli = D.createCLI({ oceanic: options.oceanic });
    }
    if (typeof cli.exec !== "function" || typeof cli.commands === "undefined") throw new TypeError("createTerminal: cli must be an OceanicOS CLI");

    var prompt = options.prompt || "oceanic>";
    var scrollback = [];       // { type: "in" | "out" | "err" | "sys", text }
    var history = [];          // submitted command lines, oldest first
    var cursor = 0;            // history navigation cursor

    function push(type, text) { scrollback.push({ type: type, text: text }); }

    function vocabulary() { return BUILTINS.concat(cli.commands).slice().sort(); }

    function submit(line) {
      var text = String(line == null ? "" : line).trim();
      if (!text) return { ok: true, blank: true, scrollback: getScrollback() };
      history.push(text);
      cursor = history.length;
      push("in", prompt + " " + text);

      var verb = text.split(/\s+/)[0].toLowerCase();
      if (verb === "clear") { scrollback = []; return { ok: true, command: "clear", scrollback: getScrollback() }; }
      if (verb === "history") {
        history.forEach(function (h, i) { push("out", String(i + 1).padStart ? String(i + 1).padStart(3, " ") + "  " + h : (i + 1) + "  " + h); });
        return { ok: true, command: "history", data: history.slice(), scrollback: getScrollback() };
      }

      var r = cli.exec(text);
      if (r.ok) { if (r.message) String(r.message).split("\n").forEach(function (l) { push("out", l); }); }
      else push("err", "! " + r.error);
      return { ok: r.ok, command: r.command, message: r.ok ? r.message : "", error: r.ok ? null : r.error, scrollback: getScrollback() };
    }

    // shell-style history walking: prev = older, next = newer (empty past the end)
    function historyPrev() {
      if (!history.length) return "";
      if (cursor > 0) cursor--;
      return history[cursor] || "";
    }
    function historyNext() {
      if (cursor < history.length) cursor++;
      return cursor >= history.length ? "" : (history[cursor] || "");
    }

    function complete(partial) {
      partial = String(partial == null ? "" : partial);
      var head = partial.split(/\s+/)[0]; // complete the verb only
      var cands = vocabulary().filter(function (c) { return c.indexOf(head) === 0; });
      var value = head;
      if (cands.length === 1) value = cands[0];
      else if (cands.length > 1) value = commonPrefix(cands) || head;
      return { matches: cands, value: value };
    }

    function getScrollback() { return scrollback.slice(); }
    function getHistory() { return history.slice(); }
    function status() { return { lines: scrollback.length, commands: history.length, vocabulary: vocabulary().length }; }

    return {
      prompt: prompt,
      submit: submit,
      historyPrev: historyPrev, historyNext: historyNext,
      complete: complete, vocabulary: vocabulary,
      scrollback: getScrollback, history: getHistory,
      help: function () { return cli.help(); },
      status: status,
      cli: cli
    };
  }

  createTerminal.BUILTINS = BUILTINS.slice();
  return createTerminal;
});
