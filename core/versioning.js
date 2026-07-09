/*
 * Ω∞ OceanicOS Core :: Versioning
 * Build 0015 · Stage 2 (Builder) · zero-runtime (plain browser or any JS engine)
 *
 * "Everything is versioned." The Charter is versioned (v1.0.0), every build is
 * numbered, the Kernel reports a version — but until now nothing could compare
 * or reason about those versions. Versioning is a small, pure Semantic
 * Versioning utility: parse, order, bump, and range-satisfy.
 *
 * Unlike the engines it holds no state, so it is exposed as a plain namespace
 * (OceanicCore.versioning) of pure functions — deterministic, dependency-free,
 * trivially testable. Supports MAJOR.MINOR.PATCH with an optional -prerelease
 * tag, full semver precedence (a prerelease is lower than its release; numeric
 * identifiers compare numerically), and the common ranges: exact, >= > <= <,
 * ^ (compatible), ~ (approximate), and * / "" (any).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.versioning = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CORE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

  function parse(v) {
    if (typeof v !== "string") throw new TypeError("version must be a string");
    var m = CORE.exec(v.trim());
    if (!m) throw new Error("not a valid semver version: " + JSON.stringify(v));
    return {
      major: parseInt(m[1], 10),
      minor: parseInt(m[2], 10),
      patch: parseInt(m[3], 10),
      prerelease: m[4] || null,
      raw: v.trim()
    };
  }

  function valid(v) { try { parse(v); return true; } catch (e) { return false; } }

  function isNumericId(s) { return /^\d+$/.test(s); }

  function comparePrerelease(a, b) {
    // no prerelease outranks a prerelease: 1.0.0 > 1.0.0-rc
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    var as = a.split("."), bs = b.split(".");
    for (var i = 0; i < Math.max(as.length, bs.length); i++) {
      if (i >= as.length) return -1; // fewer identifiers = lower precedence
      if (i >= bs.length) return 1;
      var x = as[i], y = bs[i];
      if (x === y) continue;
      var xn = isNumericId(x), yn = isNumericId(y);
      if (xn && yn) { var d = parseInt(x, 10) - parseInt(y, 10); if (d !== 0) return d < 0 ? -1 : 1; }
      else if (xn) return -1;             // numeric identifiers are lower than alphanumeric
      else if (yn) return 1;
      else return x < y ? -1 : 1;         // lexical ASCII order
    }
    return 0;
  }

  function compare(a, b) {
    var pa = parse(a), pb = parse(b);
    if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
    if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
    if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
    return comparePrerelease(pa.prerelease, pb.prerelease);
  }

  function eq(a, b)  { return compare(a, b) === 0; }
  function gt(a, b)  { return compare(a, b) > 0; }
  function gte(a, b) { return compare(a, b) >= 0; }
  function lt(a, b)  { return compare(a, b) < 0; }
  function lte(a, b) { return compare(a, b) <= 0; }

  function sort(list, descending) {
    var out = list.slice().sort(compare);
    return descending ? out.reverse() : out;
  }

  function bump(v, level) {
    var p = parse(v);
    if (level === "major") return (p.major + 1) + ".0.0";
    if (level === "minor") return p.major + "." + (p.minor + 1) + ".0";
    if (level === "patch") return p.major + "." + p.minor + "." + (p.patch + 1);
    throw new TypeError("bump level must be major, minor, or patch");
  }

  function satisfies(version, range) {
    parse(version); // validates or throws
    range = String(range == null ? "" : range).trim();
    if (range === "" || range === "*") return true;

    var m = /^(\^|~|>=|<=|>|<|=)?\s*(.+)$/.exec(range);
    if (!m) throw new Error("unparseable range: " + JSON.stringify(range));
    var op = m[1] || "=";
    var base = parse(m[2]);

    if (op === "=")  return eq(version, base.raw);
    if (op === ">")  return gt(version, base.raw);
    if (op === ">=") return gte(version, base.raw);
    if (op === "<")  return lt(version, base.raw);
    if (op === "<=") return lte(version, base.raw);

    if (op === "~") {
      // ~1.2.3 := >=1.2.3 <1.3.0  — same major.minor, patch may rise
      var upperT = base.major + "." + (base.minor + 1) + ".0";
      return gte(version, base.raw) && lt(version, upperT);
    }
    if (op === "^") {
      // ^x.y.z locks the left-most non-zero part:
      //   ^1.2.3 := >=1.2.3 <2.0.0
      //   ^0.2.3 := >=0.2.3 <0.3.0
      //   ^0.0.3 := >=0.0.3 <0.0.4
      var upperC;
      if (base.major > 0) upperC = (base.major + 1) + ".0.0";
      else if (base.minor > 0) upperC = "0." + (base.minor + 1) + ".0";
      else upperC = "0.0." + (base.patch + 1);
      return gte(version, base.raw) && lt(version, upperC);
    }
    throw new Error("unsupported range operator: " + op);
  }

  return {
    parse: parse, valid: valid, compare: compare,
    eq: eq, gt: gt, gte: gte, lt: lt, lte: lte,
    sort: sort, bump: bump, satisfies: satisfies
  };
});
