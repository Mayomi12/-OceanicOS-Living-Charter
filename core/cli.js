/*
 * Ω∞ OceanicOS :: CLI
 * Build 0012 · Stage 2 (Builder) · zero-runtime (plain browser or any JS engine)
 *
 * A single text interface to the whole system. The Kernel (0011) assembled the
 * engines; the CLI lets a person (or a script, or a later API) drive them with
 * one line of text — `oceanic start`, `observe ...`, `verify ...`, and so on.
 *
 * It is a pure interpreter: createCLI({ oceanic }).exec(line) parses one command
 * and returns a structured result { ok, command, message, data, error }. It
 * NEVER throws — an engine's refusal (an unverified ground, a bad id) is caught
 * and returned as { ok:false, error }, exactly as a real shell reports a failed
 * command without crashing the shell. That makes every path testable and keeps
 * the harness (and any host UI) simple.
 *
 * Grammar (one command per line):
 *   help                              list commands
 *   start                             boot the system (oceanic start)
 *   status                            one-line system status
 *   observe <text>                    record an observation, prints its id
 *   verify|reject|archive <oid> [note]   change an observation's status
 *   observations [status]             list observations (optionally by status)
 *   propose <question> | <opt> | <opt> [| ...]   open a decision, prints its id
 *   decide <did> <choice> [| note]    commit a decision (choice may be multi-word)
 *   decisions [status]                list decisions
 *   learn <text>                      record knowledge, prints its id
 *   knowledge [topic]                 list knowledge (optionally by topic)
 *   project <name>                    open a project, prints its id
 *   link <pid> <kind> <id>            attach a thread to a project
 *   projects [status]                 list projects
 *   builds                            list the build ledger
 *   snapshot                          size of the one Memory Ocean
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createCLI = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createCLI(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || typeof os.start !== "function" || !os.reality || !os.decisions || !os.knowledge || !os.projects || !os.builds) {
      throw new TypeError("createCLI requires an assembled OceanicOS: createCLI({ oceanic })");
    }

    // ---- command implementations. Each returns { message, data }. ----
    var commands = {
      help: { help: "list commands", run: function () {
        var names = Object.keys(commands).sort();
        return { message: "commands: " + names.join(", "), data: names };
      }},

      start: { help: "boot the system", run: function () {
        var b = os.start();
        return { message: "OceanicOS v" + os.version + " booted — pulse " + b.pulse, data: b };
      }},

      status: { help: "system status", run: function () {
        var s = os.status();
        return {
          message: "v" + s.version + (s.booted ? " · booted, pulse " + s.pulse : " · not booted") +
            " · ocean " + s.memory.count + " records · reality " + s.reality.verified + "✓/" + s.reality.pending + "? " +
            "· decisions " + s.decisions.decided + " · knowledge " + s.knowledge.established +
            " · projects " + s.projects.active + " active · builds " + s.builds.builds,
          data: s
        };
      }},

      observe: { help: "observe <text>", run: function (rest) {
        need(rest, "observe requires text");
        var r = os.reality.observe({ observation: rest, source: "cli" });
        return { message: "observed " + r.meta.oid + " [PENDING] — " + r.body, data: r };
      }},

      verify:  { help: "verify <oid> [note]",  run: obsStatus("verify") },
      reject:  { help: "reject <oid> [note]",  run: obsStatus("reject") },
      archive: { help: "archive <oid> [note]", run: obsStatus("archive") },

      observations: { help: "observations [status]", run: function (rest) {
        var list = rest ? os.reality.byStatus(rest.trim()) : os.reality.observations(false);
        return listing(list, function (r) { return r.meta.oid + " [" + r.meta.status.toUpperCase() + "] " + r.body; }, "observations");
      }},

      propose: { help: "propose <question> | <opt> | <opt>", run: function (rest) {
        need(rest, "propose requires a question and options separated by |");
        var parts = rest.split("|").map(trim).filter(nonEmpty);
        if (parts.length < 3) throw new Error("propose needs a question and at least two options: propose <q> | <opt> | <opt>");
        var q = parts[0], opts = parts.slice(1);
        var d = os.decisions.propose({ question: q, options: opts, source: "cli" });
        return { message: "proposed " + d.meta.did + " [OPEN] — " + q + " {" + opts.join(" | ") + "}", data: d };
      }},

      decide: { help: "decide <did> <choice> [| note]", run: function (rest) {
        // choice may be multi-word (options can be), so split it from the note on |
        var p = headTail(rest, "decide requires <did> <choice>");
        var did = p.head;
        if (!p.tail) throw new Error("decide requires a choice: decide <did> <choice> [| note]");
        var seg = p.tail.split("|").map(trim);
        var choice = seg[0], note = seg.length > 1 ? seg.slice(1).join("|").trim() : null;
        if (!choice) throw new Error("decide requires a choice");
        var d = os.decisions.decide(did, choice, note || null);
        return { message: "decided " + did + " → " + d.meta.choice, data: d };
      }},

      decisions: { help: "decisions [status]", run: function (rest) {
        var list = rest ? os.decisions.byStatus(rest.trim()) : os.decisions.decisions(false);
        return listing(list, function (r) { return r.meta.did + " [" + r.meta.status.toUpperCase() + "] " + r.body + (r.meta.choice ? " → " + r.meta.choice : ""); }, "decisions");
      }},

      learn: { help: "learn <text>", run: function (rest) {
        need(rest, "learn requires text");
        var k = os.knowledge.learn({ statement: rest, source: "cli" });
        return { message: "learned " + k.meta.kid + " — " + k.body, data: k };
      }},

      knowledge: { help: "knowledge [topic]", run: function (rest) {
        var list = rest ? os.knowledge.byTopic(rest.trim()) : os.knowledge.knowledge(false);
        return listing(list, function (r) { return r.meta.kid + " [" + r.meta.status.toUpperCase() + "] " + r.body; }, "knowledge");
      }},

      project: { help: "project <name>", run: function (rest) {
        need(rest, "project requires a name");
        var p = os.projects.open({ name: rest, source: "cli" });
        return { message: "opened " + p.meta.pid + " [ACTIVE] — " + p.body, data: p };
      }},

      link: { help: "link <pid> <kind> <id>", run: function (rest) {
        var a = headTail(rest, "link requires <pid> <kind> <id>");
        var b = headTail(a.tail, "link requires <kind> <id>");
        var c = headTail(b.tail, "link requires <id>");
        var p = os.projects.link(a.head, { kind: b.head, id: c.head + (c.tail ? " " + c.tail : "") });
        return { message: "linked " + b.head + " to " + a.head + " (" + p.meta.links.length + " threads)", data: p };
      }},

      projects: { help: "projects [status]", run: function (rest) {
        var list = rest ? os.projects.byStatus(rest.trim()) : os.projects.projects(false);
        return listing(list, function (r) { return r.meta.pid + " [" + r.meta.status.toUpperCase() + "] " + r.body + " (" + r.meta.links.length + " threads)"; }, "projects");
      }},

      builds: { help: "builds", run: function () {
        var list = os.builds.history();
        return listing(list, function (r) { return "#" + pad(r.meta.number) + " s" + r.meta.stage + " " + r.meta.capability; }, "builds");
      }},

      snapshot: { help: "snapshot", run: function () {
        var snap = os.exportSnapshot();
        return { message: "ocean snapshot: " + snap.length + " bytes, " + os.status().memory.count + " records", data: { bytes: snap.length } };
      }}
    };

    // ---- helpers ----
    function trim(s) { return s.trim(); }
    function nonEmpty(s) { return !!s; }
    function need(rest, msg) { if (!rest || !rest.trim()) throw new Error(msg); }
    function pad(n) { n = String(n); while (n.length < 4) n = "0" + n; return n; }
    function headTail(rest, msg) {
      if (!rest || !rest.trim()) throw new Error(msg);
      var s = rest.trim();
      var i = s.indexOf(" ");
      if (i < 0) return { head: s, tail: "" };
      return { head: s.slice(0, i), tail: s.slice(i + 1).trim() };
    }
    function obsStatus(verb) {
      return function (rest) {
        var p = headTail(rest, verb + " requires an observation id");
        var r = os.reality[verb](p.head, p.tail || null);
        return { message: verb + "ed " + p.head + " → " + r.meta.status.toUpperCase(), data: r };
      };
    }
    function listing(list, fmt, label) {
      var lines = list.map(fmt);
      return { message: lines.length ? lines.join("\n") : "(no " + label + ")", data: list };
    }

    // ---- the interpreter. Never throws. ----
    function exec(line) {
      var text = String(line == null ? "" : line).trim();
      if (!text) return { ok: false, command: null, message: "", error: "empty command" };
      var sp = text.indexOf(" ");
      var name = (sp < 0 ? text : text.slice(0, sp)).toLowerCase();
      var rest = sp < 0 ? "" : text.slice(sp + 1).trim();
      var cmd = commands[name];
      if (!cmd) return { ok: false, command: name, message: "", error: "unknown command: " + name + " (try: help)" };
      try {
        var out = cmd.run(rest);
        return { ok: true, command: name, message: out.message, data: out.data, error: null };
      } catch (e) {
        return { ok: false, command: name, message: "", data: null, error: String(e && e.message ? e.message : e) };
      }
    }

    function help() {
      return Object.keys(commands).sort().map(function (n) { return n + " — " + commands[n].help; });
    }

    return { exec: exec, help: help, commands: Object.keys(commands).sort(), oceanic: os };
  }

  return createCLI;
});
