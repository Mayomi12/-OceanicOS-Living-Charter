/*
 * Ω∞ OceanicOS :: Integrity (structural self-audit of the ocean)
 * Build 0081 · Stage 8 (Stewardship) · zero-runtime (plain browser or any JS engine)
 *
 * Provenance (0075), Retrospect (0076) and Restore (0080) all ASSUME the ocean
 * is well-formed — that ids are unique, that a `supersedes` edge points at a
 * real record, that nothing is superseded twice, that the correction graph has
 * no cycles. A live Memory (0005) guarantees all of this: its guards make a
 * malformed ocean impossible. But an ocean HYDRATED from an external snapshot —
 * hand-edited, truncated, merged by some other tool — carries no such promise.
 *
 * Integrity is the guardrail that lets you trust such an ocean before the other
 * lenses read it. It re-derives, from the records alone, every invariant Memory
 * would have enforced, and reports each breach as a finding that carries its
 * severity AND its fix — the same shape as the Security (0056) and
 * Accessibility (0060) audits.
 *
 *   createIntegrity({ memory })          // memory: anything with timeline()
 *   audit()  → { findings, passed, checks, score, posture, note, headline }
 *   ok()     → true iff there are no findings
 *
 * THE STATED LIMIT (house honesty): this audits STRUCTURE, not TRUTH. Whether a
 * record's content is correct, or a conclusion rests on verified grounds, is the
 * Reasoner's domain (0028) — not this one. A structurally sound ocean can still
 * be wrong; Integrity only promises it is well-formed.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createIntegrity = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULT_CONFIDENCE = ["certain", "high", "medium", "low", "speculation"];

  function createIntegrity(options) {
    options = options || {};
    var memory = options.memory;
    if (!memory || typeof memory.timeline !== "function") {
      throw new TypeError("createIntegrity needs { memory } — anything with a timeline() of records");
    }
    var CONFIDENCE = options.confidenceValues ||
      (root_createMemoryConfidence()) || DEFAULT_CONFIDENCE;

    function root_createMemoryConfidence() {
      try {
        var r = (typeof self !== "undefined" ? self : this);
        if (r && r.OceanicCore && r.OceanicCore.createMemory && r.OceanicCore.createMemory.CONFIDENCE) {
          return r.OceanicCore.createMemory.CONFIDENCE;
        }
      } catch (e) {}
      return null;
    }

    function audit() {
      var recs = memory.timeline();
      var out = [];
      function finding(id, name, severity, offenders, detail, fix) {
        out.push({ id: id, name: name, verdict: "finding", severity: severity,
                   count: offenders.length || null, sample: offenders.length ? offenders[0] : null,
                   offenders: offenders.slice(0, 20), detail: detail, fix: fix });
      }
      function pass(id, name, detail) {
        out.push({ id: id, name: name, verdict: "pass", severity: null, count: null, sample: null, offenders: [], detail: detail, fix: null });
      }

      // index by id (first occurrence wins, so we can still walk a corrupt ocean)
      var byId = {}, present = {}, dupes = [];
      recs.forEach(function (r) {
        if (present[r.id]) dupes.push(r.id);
        else { present[r.id] = true; byId[r.id] = r; }
      });

      // INTEG-ID — ids are unique
      if (dupes.length) finding("INTEG-ID", "every record has a unique id", "high", dupes,
        dupes.length + " duplicate id(s) — a later record silently shadows an earlier one",
        "regenerate ids so each record is addressable; never reuse an id");
      else pass("INTEG-ID", "every record has a unique id", recs.length + " record(s), all distinct");

      // walk supersedes edges once, collecting every structural fault
      var selfSup = [], dangling = [], supBy = {};
      recs.forEach(function (r) {
        if (!r.supersedes) return;
        if (r.supersedes === r.id) selfSup.push(r.id);
        if (!present[r.supersedes]) dangling.push(r.id);
        (supBy[r.supersedes] = supBy[r.supersedes] || []).push(r.id);
      });

      // INTEG-SUPERSEDES-EXISTS — a correction points at a real record
      if (dangling.length) finding("INTEG-SUPERSEDES-EXISTS", "every supersedes edge points at a present record", "high", dangling,
        dangling.length + " record(s) supersede an id that is not in this ocean — a broken lineage",
        "restore the missing ancestor, or drop the dangling supersedes reference");
      else pass("INTEG-SUPERSEDES-EXISTS", "every supersedes edge points at a present record", "all corrections resolve");

      // INTEG-SUPERSEDES-ONCE — Memory's 1:1 rule: a record is corrected by at most one successor
      var twice = Object.keys(supBy).filter(function (k) { return supBy[k].length > 1; });
      if (twice.length) finding("INTEG-SUPERSEDES-ONCE", "no record is superseded more than once", "high", twice,
        twice.length + " record(s) are superseded by TWO or more successors — the lineage forks, and 'current' is ambiguous",
        "keep one supersession per record; amend the current tip, not an already-superseded record");
      else pass("INTEG-SUPERSEDES-ONCE", "no record is superseded more than once", "each lineage stays a single line");

      // INTEG-SELF — nothing supersedes itself
      if (selfSup.length) finding("INTEG-SELF", "no record supersedes itself", "high", selfSup,
        selfSup.length + " record(s) declare themselves their own predecessor",
        "a correction is a NEW record; clear the self-referential supersedes");
      else pass("INTEG-SELF", "no record supersedes itself", "no self-references");

      // INTEG-NO-CYCLE — the supersession graph is acyclic
      var cyclic = [];
      recs.forEach(function (r) {
        var cur = r, seen = {};
        while (cur && cur.supersedes) {
          if (seen[cur.id]) { cyclic.push(r.id); break; }
          seen[cur.id] = true;
          cur = byId[cur.supersedes];
        }
      });
      if (cyclic.length) finding("INTEG-NO-CYCLE", "the supersession graph has no cycles", "high", cyclic,
        cyclic.length + " record(s) sit on a supersedes CYCLE — a lineage that never reaches an origin",
        "break the loop; history is a line back to a first record, not a ring");
      else pass("INTEG-NO-CYCLE", "the supersession graph has no cycles", "every lineage reaches an origin");

      // INTEG-BODY — every record has a non-empty string body
      var emptyBody = recs.filter(function (r) { return typeof r.body !== "string" || !r.body; }).map(function (r) { return r.id; });
      if (emptyBody.length) finding("INTEG-BODY", "every record has a non-empty body", "medium", emptyBody,
        emptyBody.length + " record(s) have an empty or non-string body — a record that says nothing",
        "give every record a meaningful string body, as remember() requires");
      else pass("INTEG-BODY", "every record has a non-empty body", "all records carry content");

      // INTEG-CONFIDENCE — confidence is one of the allowed values
      var badConf = recs.filter(function (r) { return r.confidence !== undefined && CONFIDENCE.indexOf(r.confidence) < 0; }).map(function (r) { return r.id; });
      if (badConf.length) finding("INTEG-CONFIDENCE", "confidence is a known level", "medium", badConf,
        badConf.length + " record(s) carry a confidence outside {" + CONFIDENCE.join(", ") + "}",
        "set confidence to one of the known levels; confidence is never presented as certainty");
      else pass("INTEG-CONFIDENCE", "confidence is a known level", "all confidences valid");

      var findings = out.filter(function (c) { return c.verdict === "finding"; });
      var passed = out.filter(function (c) { return c.verdict === "pass"; });
      var high = findings.filter(function (f) { return f.severity === "high"; }).length;
      var medium = findings.length - high;
      var score = Math.max(0, 100 - high * 25 - medium * 10);
      var posture = high > 0 ? "corrupt" : medium > 0 ? "flawed" : "sound";
      return {
        findings: findings, passed: passed, checks: out,
        score: score, posture: posture, records: recs.length,
        note: "structure only — a well-formed ocean can still be wrong; truth and soundness are the Reasoner's domain (0028)",
        headline: posture === "sound"
          ? "SOUND — " + passed.length + "/" + out.length + " structural checks pass (" + recs.length + " records)"
          : posture.toUpperCase() + " — " + findings.map(function (f) { return f.id; }).join(", ") + " (score " + score + ")"
      };
    }

    function ok() { return audit().findings.length === 0; }

    return { audit: audit, ok: ok };
  }

  return createIntegrity;
});
