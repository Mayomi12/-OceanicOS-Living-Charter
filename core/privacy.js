/*
 * Ω∞ OceanicOS :: Privacy
 * Build 0057 · Stage 8 (Stewardship) · zero-runtime (plain browser or any JS engine)
 *
 * Stewardship of PEOPLE's data. Privacy makes personal data a first-class,
 * inspectable concern over the one Memory Ocean:
 *
 *   mark(id, { subject, sensitivity })  → classify a record as being ABOUT
 *       someone ("public" | "personal" | "sensitive") — an open amendment
 *       that preserves the engines' own metadata (a verified observation
 *       stays verified)
 *   inventory(subject)                  → everything currently known about a
 *       person, across every record type — the data map
 *   access(subject)                     → the portable export of that map
 *   redact(id, reason)                  → withdraw a record's CONTENT from
 *       every current read: the body becomes a tombstone, search stops
 *       finding it, the engines keep working on the record's status
 *   forget(subject, reason)             → redact ALL of a person's personal +
 *       sensitive records at once; their public record is untouched
 *   audit() · status()
 *
 * THE HONEST LIMIT, stated rather than hidden: this ocean is append-only, so
 * redaction is SUPERSESSION — the original content remains in deep history
 * (timeline / includeSuperseded) until a future Migration rebuilds an ocean
 * without it. What redaction guarantees today: no current read, search, or
 * export will surface the content again. What it cannot claim: cryptographic
 * erasure. A privacy capability that pretended otherwise would violate the
 * Charter twice over.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createPrivacy = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SENSITIVITIES = { "public": 1, personal: 1, sensitive: 1 };

  function cloneMeta(meta) {
    var out = {};
    if (meta) Object.keys(meta).forEach(function (k) {
      var v = meta[k];
      out[k] = Array.isArray(v) ? v.slice() : v; // engine metas are flat or arrays of flats
    });
    return out;
  }

  function createPrivacy(options) {
    options = options || {};
    var os = options.oceanic;
    var memory = options.memory || (os && os.memory);
    if (!memory || typeof memory.recall !== "function" || typeof memory.amend !== "function") {
      throw new TypeError("createPrivacy requires an OceanicOS or a Memory: createPrivacy({ oceanic })");
    }
    var logger = options.logger || null;

    // resolve a CURRENT record by its memory id or its logical id (oid/did/kid/pid)
    function currentRecord(id) {
      var all = memory.recall({});
      for (var i = 0; i < all.length; i++) {
        var r = all[i], m = r.meta || {};
        if (r.id === id || m.oid === id || m.did === id || m.kid === id || m.pid === id) return r;
      }
      return null;
    }
    function privacyOf(r) { return (r.meta && r.meta.privacy) || null; }
    function shape(r) {
      var p = privacyOf(r);
      return { id: r.id, type: r.type, body: r.body, source: r.source,
               subject: p ? p.subject : null, sensitivity: p ? p.sensitivity : "public",
               redacted: !!(p && p.redacted), reason: p ? (p.reason || null) : null };
    }

    function mark(id, opts) {
      if (!opts || typeof opts.subject !== "string" || !opts.subject) {
        throw new TypeError("mark requires a subject — personal data is data ABOUT someone");
      }
      if (!SENSITIVITIES[opts.sensitivity]) {
        throw new TypeError("sensitivity must be one of: " + Object.keys(SENSITIVITIES).join(", "));
      }
      var rec = currentRecord(id);
      if (!rec) throw new Error("no current record " + id + " in the ocean");
      var p = privacyOf(rec);
      if (p && p.redacted) throw new Error("record " + id + " is redacted — its classification is settled");
      var meta = cloneMeta(rec.meta);
      meta.privacy = { subject: opts.subject, sensitivity: opts.sensitivity, redacted: false, reason: null };
      var amended = memory.amend(rec.id, { type: rec.type, body: rec.body, source: rec.source,
                                           confidence: rec.confidence, meta: meta });
      return shape(amended);
    }

    function inventory(subject) {
      if (typeof subject !== "string" || !subject) throw new TypeError("inventory requires a subject");
      return memory.recall({}).filter(function (r) {
        var p = privacyOf(r);
        return p && p.subject === subject;
      }).map(shape);
    }

    function access(subject) {
      var data = inventory(subject);
      return JSON.stringify({ subject: subject, records: data.length, exported: data });
    }

    function redact(id, reason) {
      if (typeof reason !== "string" || !reason) throw new TypeError("redact requires a reason — withdrawal is itself on the record");
      var rec = currentRecord(id);
      if (!rec) throw new Error("no current record " + id + " in the ocean");
      var p = privacyOf(rec);
      if (p && p.redacted) throw new Error("record " + id + " is already redacted");
      var meta = cloneMeta(rec.meta);
      meta.privacy = { subject: p ? p.subject : null, sensitivity: p ? p.sensitivity : "public",
                       redacted: true, reason: reason };
      var amended = memory.amend(rec.id, {
        type: rec.type,
        body: "[redacted — " + reason + "]", // content withdrawn from every current read
        source: rec.source, confidence: rec.confidence, meta: meta
      });
      if (logger) try { logger.warn("privacy · record " + rec.id + " redacted: " + reason); } catch (e) {}
      return shape(amended);
    }

    function forget(subject, reason) {
      if (typeof reason !== "string" || !reason) throw new TypeError("forget requires a reason");
      var targets = inventory(subject).filter(function (r) {
        return !r.redacted && r.sensitivity !== "public";
      });
      targets.forEach(function (r) { redact(r.id, reason); });
      if (logger) try { logger.warn("privacy · forget('" + subject + "'): " + targets.length + " record(s) redacted"); } catch (e) {}
      return { subject: subject, redacted: targets.length,
               note: targets.length
                 ? "content withdrawn from all current reads; originals remain in deep history until a Migration rebuilds without them"
                 : "nothing to withdraw" };
    }

    function audit() {
      var marked = memory.recall({}).filter(function (r) { return !!privacyOf(r); }).map(shape);
      var bySensitivity = {};
      var subjects = {};
      var redacted = 0, exposedSensitive = 0;
      marked.forEach(function (r) {
        bySensitivity[r.sensitivity] = (bySensitivity[r.sensitivity] || 0) + 1;
        if (r.subject) subjects[r.subject] = 1;
        if (r.redacted) redacted += 1;
        else if (r.sensitivity === "sensitive") exposedSensitive += 1;
      });
      return { marked: marked.length, bySensitivity: bySensitivity,
               subjects: Object.keys(subjects).sort(), redacted: redacted,
               sensitiveInTheOpen: exposedSensitive };
    }

    function status() {
      var a = audit();
      return { marked: a.marked, subjects: a.subjects.length, redacted: a.redacted,
               sensitiveInTheOpen: a.sensitiveInTheOpen };
    }

    return { mark: mark, inventory: inventory, access: access,
             redact: redact, forget: forget, audit: audit, status: status };
  }

  createPrivacy.SENSITIVITIES = Object.keys(SENSITIVITIES);
  return createPrivacy;
});
