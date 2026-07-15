/*
 * Ω∞ OceanicOS :: Security
 * Build 0056 · Stage 8 (Stewardship) · zero-runtime (plain browser or any JS engine)
 *
 * Stewardship begins with locking the doors — and PROVING they are locked.
 * Security is the audit made a capability: a pure sweep of the assembled
 * system for the open doors that actually exist in THIS architecture,
 * composing what is already built rather than imagining threats:
 *
 *   SEC-ANON     anonymous authority — can a caller with no identity WRITE?
 *                (probes Permissions 0036 behaviourally, not by config)
 *   SEC-WRITES   ungated engines — no Permissions layer at all means every
 *                caller is every role
 *   SEC-APPS     the platform fleet (0053) — over-broad "*" grants, and
 *                ORPHANED apps whose responsible owner is no longer active
 *   SEC-SECRETS  keys in the ocean — the append-only Memory never forgets,
 *                so a leaked secret is leaked FOREVER; sweep the snapshot
 *   SEC-GATE     an unwatched or unhealthy system (Monitor 0047)
 *   SEC-STEWARD  no active steward/admin — no one can pass verdicts, so
 *                pending reality silts up unverified
 *
 *   audit()   → { findings, passed, score, posture, headline } — each finding
 *               carries its severity (high/medium/low) AND its fix
 *   posture() → "hardened" (clean) · "guarded" (medium findings) · "exposed" (high)
 *
 * The audit is pure — it reads, judges, and reports; hardening is a human's
 * (or Automation's) act. Trust is earned and continuously maintained.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createSecurity = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var KEY_PATTERN = /ok_[a-z0-9][a-z0-9-]*_\d+_[0-9a-f]{6,}/; // the Platform's key shape

  function createSecurity(options) {
    options = options || {};
    var os = options.oceanic;
    if (!os || !os.memory || typeof os.exportSnapshot !== "function") {
      throw new TypeError("createSecurity requires an assembled OceanicOS: createSecurity({ oceanic, ... })");
    }
    var permissions = options.permissions || null;
    var identity = options.identity || null;
    var platform = options.platform || null;
    var monitor = options.monitor || null;
    var logger = options.logger || null;

    function finding(id, name, severity, detail, fix) {
      return { id: id, name: name, verdict: "finding", severity: severity, detail: detail, fix: fix };
    }
    function pass(id, name, detail) {
      return { id: id, name: name, verdict: "pass", severity: null, detail: detail, fix: null };
    }

    function checks() {
      var out = [];

      // SEC-WRITES / SEC-ANON — authorization posture
      if (!permissions) {
        out.push(finding("SEC-WRITES", "engines are gated", "medium",
          "no Permissions layer is attached — every caller is every role",
          "create Permissions (0036) over Identity and wrap the API: permissions.wrap(api)"));
      } else {
        out.push(pass("SEC-WRITES", "engines are gated", "a Permissions layer answers for every operation"));
        var anonWrites = false;
        try { anonWrites = permissions.can("reality.observe", null) === true; } catch (e) {}
        if (anonWrites) {
          out.push(finding("SEC-ANON", "anonymous cannot write", "high",
            "a caller with NO identity may record observations — provenance cannot be trusted",
            "configure Permissions with anonymous: null (or at most 'observer')"));
        } else {
          out.push(pass("SEC-ANON", "anonymous cannot write", "an unidentified caller is refused write access"));
        }
      }

      // SEC-APPS — the third-party fleet
      if (platform) {
        var apps = platform.apps().filter(function (a) { return a.status === "active"; });
        var broad = apps.filter(function (a) { return a.scopes.indexOf("*") >= 0; });
        var orphaned = identity ? apps.filter(function (a) {
          var owner = identity.get(a.owner);
          return !owner || owner.status !== "active";
        }) : [];
        if (orphaned.length) {
          out.push(finding("SEC-APPS", "every app has a living owner", "high",
            orphaned.length + " active app(s) whose responsible owner is retired or gone: " +
            orphaned.map(function (a) { return a.id; }).join(", "),
            "revoke the orphaned app(s) or transfer ownership to an active actor"));
        } else if (broad.length) {
          out.push(finding("SEC-APPS", "app scopes follow least privilege", "medium",
            broad.length + " active app(s) hold the full '*' scope: " + broad.map(function (a) { return a.id; }).join(", "),
            "narrow each app to the operations it actually uses (e.g. 'reality.*')"));
        } else {
          out.push(pass("SEC-APPS", "app scopes follow least privilege",
            apps.length + " active app(s), all scoped, all owned by active actors"));
        }
      }

      // SEC-SECRETS — the ocean never forgets
      var snapshot = os.exportSnapshot();
      if (KEY_PATTERN.test(snapshot)) {
        out.push(finding("SEC-SECRETS", "no secrets in the ocean", "high",
          "a platform key pattern appears in the persisted ocean — append-only memory means it is leaked FOREVER",
          "revoke the exposed app immediately (the record cannot be deleted; the key must die instead)"));
      } else {
        out.push(pass("SEC-SECRETS", "no secrets in the ocean", "the snapshot carries no key material"));
      }

      // SEC-GATE — is anyone watching?
      if (!monitor) {
        out.push(finding("SEC-GATE", "the system is watched", "low",
          "no Monitor is attached — failures would go unseen",
          "attach a Monitor (0047) with a Logger and check releaseGate() before shipping"));
      } else if (!monitor.healthy()) {
        out.push(finding("SEC-GATE", "the system is watched", "medium",
          "the Monitor reports the system UNHEALTHY: " + monitor.releaseGate().headline,
          "resolve the monitor's blockers before trusting or shipping this system"));
      } else {
        out.push(pass("SEC-GATE", "the system is watched", "monitored and currently healthy"));
      }

      // SEC-STEWARD — can verdicts be passed at all?
      if (identity) {
        var stewards = identity.byRole("steward").length + identity.byRole("admin").length;
        if (stewards === 0) {
          out.push(finding("SEC-STEWARD", "verdicts have a bearer", "medium",
            "no active steward or admin — nobody can verify reality or ratify change; pending records will silt up",
            "grant steward to a trusted actor (identity.setRole) — authority over records, never over humans"));
        } else {
          out.push(pass("SEC-STEWARD", "verdicts have a bearer", stewards + " active steward(s)/admin(s)"));
        }
      }

      return out;
    }

    function audit() {
      var all = checks();
      var findings = all.filter(function (c) { return c.verdict === "finding"; });
      var passed = all.filter(function (c) { return c.verdict === "pass"; });
      var high = findings.filter(function (f) { return f.severity === "high"; }).length;
      var medium = findings.filter(function (f) { return f.severity === "medium"; }).length;
      var low = findings.filter(function (f) { return f.severity === "low"; }).length;
      var score = Math.max(0, 100 - high * 30 - medium * 10 - low * 3);
      var posture = high > 0 ? "exposed" : (medium > 0 ? "guarded" : "hardened");
      if (logger) {
        findings.forEach(function (f) {
          try { logger.warn("security · " + f.id + " (" + f.severity + "): " + f.detail); } catch (e) {}
        });
      }
      return {
        findings: findings, passed: passed,
        counts: { high: high, medium: medium, low: low },
        score: score, posture: posture,
        headline: posture === "hardened"
          ? "HARDENED — " + passed.length + "/" + all.length + " doors proven locked (score " + score + ")"
          : posture.toUpperCase() + " — " + findings.length + " finding(s): " +
            findings.map(function (f) { return f.id; }).join(", ") + " (score " + score + ")"
      };
    }

    function posture() { return audit().posture; }
    function status() {
      var a = audit();
      return { posture: a.posture, score: a.score, findings: a.findings.length, passed: a.passed.length };
    }

    return { audit: audit, checks: checks, posture: posture, status: status };
  }

  createSecurity.KEY_PATTERN = KEY_PATTERN;
  return createSecurity;
});
