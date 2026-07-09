/*
 * Ω∞ OceanicOS :: Documentation
 * Build 0018 · Stage 2 (Builder) · zero-runtime (plain browser or any JS engine)
 *
 * The last thread of Stage 2, and the one that describes all the others.
 * createDocs() GENERATES the system's documentation rather than storing a prose
 * copy that drifts out of date. It draws from two live sources:
 *
 *  - a CAPABILITIES index — one row per released build (number, stage, name,
 *    module, verification page, summary); the machine-readable form of the
 *    Build Log;
 *  - the API's own describe() (0017) — the operation reference, straight from
 *    the running contract, so the docs cannot disagree with the code.
 *
 * Output is offered as structured data, as Markdown (toMarkdown), and as DOM
 * (render). Because it is derived, "keeping the docs current" means adding a
 * capability row when a build ships — which the build ALREADY does in the Build
 * Log — not rewriting paragraphs.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createDocs = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // The capabilities index — every released build, in order. The single
  // machine-readable catalogue the documentation is generated from.
  var CAPABILITIES = [
    { build: "0003", stage: 0, name: "Heartbeat",              module: "core/heartbeat.js",       verify: "core/verify.html",                  summary: "A deterministic, observable pulse — the system can start." },
    { build: "0004", stage: 1, name: "Verification Engine",    module: "core/verify-engine.js",   verify: "core/verify-engine.verify.html",    summary: "A reusable test runner; every capability registers its assertions with it." },
    { build: "0005", stage: 1, name: "Memory",                 module: "core/memory.js",          verify: "core/memory.verify.html",           summary: "An append-only record store with provenance; no delete, corrections are open." },
    { build: "0006", stage: 1, name: "Build Registry",         module: "core/build-registry.js",  verify: "core/build-registry.verify.html",   summary: "The doctrine's ledger as a capability; strictly sequential, verified builds only." },
    { build: "0007", stage: 1, name: "Reality Engine",         module: "core/reality-engine.js",  verify: "core/reality-engine.verify.html",   summary: "Stores observations; pending → verified | rejected | archived." },
    { build: "0008", stage: 1, name: "Decision Engine",        module: "core/decision-engine.js", verify: "core/decision-engine.verify.html",  summary: "Grounded decisions; a commit requires verified reality." },
    { build: "0009", stage: 1, name: "Knowledge Engine",       module: "core/knowledge-engine.js",verify: "core/knowledge-engine.verify.html", summary: "Topic-indexed, revisable knowledge resting on verified grounds." },
    { build: "0010", stage: 1, name: "Projects Engine",        module: "core/projects-engine.js", verify: "core/projects-engine.verify.html",  summary: "Ties threads into a named effort; append-only typed links." },
    { build: "0011", stage: 2, name: "Kernel",                 module: "core/oceanic.js",         verify: "core/oceanic.verify.html",          summary: "Assembles all Core into one system over a single Memory Ocean." },
    { build: "0012", stage: 2, name: "CLI",                    module: "core/cli.js",             verify: "core/cli.verify.html",              summary: "One text interface; a pure interpreter that never throws." },
    { build: "0013", stage: 2, name: "Continuous Verification",module: "core/verify-all.html",    verify: "core/verify-all.html",              summary: "Runs every suite and reports one aggregate verdict." },
    { build: "0014", stage: 2, name: "Logger",                 module: "core/logger.js",          verify: "core/logger.verify.html",           summary: "The system's operational record — levels, bounded, observable." },
    { build: "0015", stage: 2, name: "Versioning",             module: "core/versioning.js",      verify: "core/versioning.verify.html",       summary: "Pure SemVer — parse, compare, sort, bump, satisfies." },
    { build: "0016", stage: 2, name: "Automation",             module: "core/automation.js",      verify: "core/automation.verify.html",       summary: "The build loop as a fail-fast pipeline that leaves evidence." },
    { build: "0017", stage: 2, name: "API",                    module: "core/api.js",             verify: "core/api.verify.html",              summary: "A stable, versioned, self-describing contract over the Kernel." },
    { build: "0018", stage: 2, name: "Documentation",          module: "core/docs.js",            verify: "core/docs.verify.html",             summary: "Generates the system's documentation from its own live sources." }
  ];

  function createDocs(options) {
    options = options || {};
    var api = options.api || null;
    if (api && typeof api.describe !== "function") throw new TypeError("createDocs: api, if provided, must be an API (needs describe())");
    var capabilities = options.capabilities || CAPABILITIES;

    function operations() { return api ? api.describe().operations : []; }

    function toMarkdown() {
      var lines = [];
      lines.push("# Ω∞ OceanicOS — Capabilities");
      lines.push("");
      lines.push("_Generated documentation. " + capabilities.length + " released capabilities. Every entry has a module and a verification page; a capability is not released until its suite passes._");
      lines.push("");
      lines.push("| Build | Stage | Capability | Module | Verify | Summary |");
      lines.push("|-------|-------|-----------|--------|--------|---------|");
      capabilities.forEach(function (c) {
        lines.push("| " + c.build + " | " + c.stage + " | **" + c.name + "** | `" + c.module + "` | `" + c.verify + "` | " + c.summary + " |");
      });

      if (api) {
        var d = api.describe();
        lines.push("");
        lines.push("## API reference (v" + d.version + ")");
        lines.push("");
        lines.push("_Generated from `api.describe()` — the live contract._");
        lines.push("");
        var group = null;
        d.operations.forEach(function (op) {
          if (op.group !== group) { group = op.group; lines.push(""); lines.push("### " + group); }
          var params = op.params.map(function (p) { return p.name + (p.required ? "*" : "") + ":" + p.type; }).join(", ") || "—";
          lines.push("- **`" + op.name + "`**(" + params + ") → `" + op.returns + "` — " + op.summary);
        });
        lines.push("");
        lines.push("_* = required parameter._");
      }
      return lines.join("\n");
    }

    function render(element) {
      if (!element || typeof element.appendChild !== "function") throw new TypeError("render requires a DOM element");
      var doc = element.ownerDocument;
      function el(tag, text, cls) { var e = doc.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }

      element.appendChild(el("h2", "Capabilities (" + capabilities.length + ")"));
      var t = doc.createElement("table");
      var head = t.insertRow();
      ["Build", "Stage", "Capability", "Module", "Summary"].forEach(function (h) { var th = doc.createElement("th"); th.textContent = h; head.appendChild(th); });
      capabilities.forEach(function (c) {
        var row = t.insertRow();
        row.insertCell().textContent = c.build;
        row.insertCell().textContent = "S" + c.stage;
        var nameCell = row.insertCell();
        var a = doc.createElement("a"); a.href = c.verify; a.textContent = c.name; a.title = "open verification"; nameCell.appendChild(a);
        var mc = row.insertCell(); var code = doc.createElement("code"); code.textContent = c.module; mc.appendChild(code);
        row.insertCell().textContent = c.summary;
      });
      element.appendChild(t);

      if (api) {
        var d = api.describe();
        element.appendChild(el("h2", "API reference (v" + d.version + ")"));
        var at = doc.createElement("table");
        var ah = at.insertRow();
        ["Operation", "Params", "Returns", "Summary"].forEach(function (h) { var th = doc.createElement("th"); th.textContent = h; ah.appendChild(th); });
        d.operations.forEach(function (op) {
          var row = at.insertRow();
          var oc = row.insertCell(); var c1 = doc.createElement("code"); c1.textContent = op.name; oc.appendChild(c1);
          row.insertCell().textContent = op.params.map(function (p) { return p.name + (p.required ? "*" : "") + ":" + p.type; }).join(", ") || "—";
          row.insertCell().textContent = op.returns;
          row.insertCell().textContent = op.summary;
        });
        element.appendChild(at);
      }
      return element;
    }

    function status() {
      return { capabilities: capabilities.length, operations: operations().length, hasApi: !!api };
    }

    return { capabilities: function () { return capabilities.slice(); }, operations: operations,
             toMarkdown: toMarkdown, render: render, status: status };
  }

  createDocs.CAPABILITIES = CAPABILITIES.slice();
  return createDocs;
});
