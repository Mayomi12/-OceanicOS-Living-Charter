/*
 * Ω∞ OceanicOS :: Reasoning
 * Build 0030 · Stage 4 (Intelligence) · zero-runtime (plain browser or any JS engine)
 *
 * The third Intelligence capability: conclusions you can AUDIT. This is not a
 * black box — createReasoning() is a derivation engine with a fixed, named,
 * self-describing rule set. It examines only what the ocean already declares
 * (grounds, statuses, confidences) and derives findings, where every finding
 * states WHICH rule fired, WHICH premises (real record ids) it used, and a
 * confidence that is NEVER stronger than its weakest premise.
 *
 * Reasoning under the Charter (Article II — Truth):
 *   - explicit → five deterministic structural rules, listed by rules();
 *                no hidden steps, no inference the page cannot display.
 *   - grounded → every premise is a record of this ocean, cited by id.
 *   - humble   → the weakest-premise law: a derived confidence is the MINIMUM
 *                of its premises' confidences on the shared scale
 *                (certain · high · medium · low · speculation). Reality is
 *                always larger than every model.
 *   - current  → decidable freshness: findings recompute exactly when the
 *                append-only ocean's count moves — never served stale.
 *   - harmless → analyze() writes nothing. Findings are PROPOSALS for the
 *                human; acting on one goes through the engines, which govern.
 *
 * reasoning.html is the screen.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createReasoning = factory(root);
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var VERSION = "0.30.0";
  var SCALE = ["speculation", "low", "medium", "high", "certain"];   // weakest first

  var RULES = [
    { name: "well-grounded",         summary: "Established knowledge whose record-grounds are all VERIFIED observations is supported by verified reality; its confidence is the minimum of its premises'." },
    { name: "eroded-ground",         summary: "Knowledge or a decision citing a ground that is now ARCHIVED or REJECTED rests on eroded reality and flows back for re-examination (Article IV)." },
    { name: "ready-to-decide",       summary: "An OPEN decision whose record-grounds are all VERIFIED may be committed — every ground is verified." },
    { name: "blocked-decision",      summary: "An OPEN decision with pending grounds waits on pending reality; the premises name exactly what blocks it." },
    { name: "unsupported-knowledge", summary: "Established knowledge citing no record of this ocean rests on external provenance or none — evidence before assumption (Article II)." }
  ];

  function rank(c) { var i = SCALE.indexOf(String(c || "medium")); return i < 0 ? 2 : i; }
  function minConfidence(list) {
    if (!list || !list.length) return "medium";
    var lowest = 4;
    list.forEach(function (c) { var r = rank(c); if (r < lowest) lowest = r; });
    return SCALE[lowest];
  }

  function createReasoning(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || typeof os.start !== "function" || !os.status) {
      throw new TypeError("createReasoning requires an assembled OceanicOS: createReasoning({ oceanic })");
    }
    var D = options.deps || (root && root.OceanicCore) || {};
    function need(fn, what) { if (typeof fn !== "function") throw new Error("createReasoning: " + what + " factory is unavailable — load the Core scripts or pass { deps }"); return fn; }
    var logger = options.logger || need(D.createLogger, "logger")({ now: options.now, minLevel: "info" });

    var cache = [];
    var analyzedAt = -1;
    var booted = false;

    function boot() {
      if (booted) return status();
      var b = os.start();
      booted = true;
      logger.info("reasoning online — OceanicOS v" + os.version + " booted on pulse " + b.pulse);
      return status();
    }

    function rules() { return RULES.map(function (r) { return { name: r.name, summary: r.summary }; }); }

    function derive() {
      var out = [];
      var obsById = {};
      os.reality.observations(false).forEach(function (r) { obsById[r.meta.oid] = r; });

      function split(grounds) {
        var rec = [], ext = [];
        (grounds || []).forEach(function (g) { (obsById[g] ? rec : ext).push(g); });
        return { rec: rec, ext: ext };
      }
      function finding(rule, subject, conclusion, premises, confidence) {
        out.push({ rule: rule, subject: subject, conclusion: conclusion, premises: premises.slice(), confidence: confidence });
      }

      os.knowledge.knowledge(false).forEach(function (k) {
        if (k.meta.status !== "established") return;
        var subject = { id: k.meta.kid, type: "knowledge", label: k.body };
        var g = split(k.meta.grounds);
        var eroded = g.rec.filter(function (id) { var s = obsById[id].meta.status; return s === "archived" || s === "rejected"; });
        if (eroded.length) {
          finding("eroded-ground", subject, "cites eroded reality — flows back for re-examination", eroded, "certain");
        }
        if (!g.rec.length) {
          finding("unsupported-knowledge", subject, "rests on external provenance or none — evidence before assumption", [], "certain");
          return;
        }
        var allVerified = g.rec.every(function (id) { return obsById[id].meta.status === "verified"; });
        if (allVerified) {
          var conf = minConfidence(g.rec.map(function (id) { return obsById[id].confidence; }));
          finding("well-grounded", subject, "supported by verified reality", g.rec, conf);
        }
      });

      os.decisions.decisions(false).forEach(function (d) {
        var subject = { id: d.meta.did, type: "decision", label: d.body };
        var g = split(d.meta.grounds);
        var eroded = g.rec.filter(function (id) { var s = obsById[id].meta.status; return s === "archived" || s === "rejected"; });
        if (eroded.length) {
          finding("eroded-ground", subject, "cites eroded reality — flows back for re-examination", eroded, "certain");
        }
        if (d.meta.status !== "open" || !g.rec.length) return;
        var pending = g.rec.filter(function (id) { return obsById[id].meta.status === "pending"; });
        if (pending.length) {
          finding("blocked-decision", subject, "waits on pending reality", pending, "certain");
        } else if (g.rec.every(function (id) { return obsById[id].meta.status === "verified"; })) {
          var conf = minConfidence(g.rec.map(function (id) { return obsById[id].confidence; }));
          finding("ready-to-decide", subject, "every ground is verified — the decision may be committed", g.rec, conf);
        }
      });

      return out;
    }

    function fresh() {
      var count = os.status().memory.count;
      if (count !== analyzedAt) {
        cache = derive();
        analyzedAt = count;
        logger.info("reasoning analyzed the ocean — " + cache.length + " findings over " + count + " records");
      }
    }

    function shape(f) {
      return { rule: f.rule, subject: { id: f.subject.id, type: f.subject.type, label: f.subject.label },
               conclusion: f.conclusion, premises: f.premises.slice(), confidence: f.confidence };
    }

    function analyze() {
      fresh();
      return { findings: cache.map(shape), at: analyzedAt };
    }

    function findings(rule) {
      fresh();
      var all = cache.map(shape);
      return rule ? all.filter(function (f) { return f.rule === rule; }) : all;
    }

    function about(id) {
      fresh();
      return cache.filter(function (f) {
        return f.subject.id === id || f.premises.indexOf(id) >= 0;
      }).map(shape);
    }

    function status() {
      return { version: VERSION, booted: booted, findings: cache.length, rules: RULES.length, oceanAt: analyzedAt };
    }

    return {
      version: VERSION,
      boot: boot, rules: rules, analyze: analyze, findings: findings, about: about,
      confidence: minConfidence, scale: SCALE.slice(),
      status: status,
      oceanic: os, logger: logger
    };
  }

  createReasoning.VERSION = VERSION;
  createReasoning.RULES = RULES.slice();
  return createReasoning;
});
