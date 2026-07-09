/*
 * Ω∞ OceanicOS Core :: Verification Engine
 * Build 0004 · Stage 1 · zero-runtime (plain browser or any JS engine)
 *
 * Formalizes the doctrine step "Verify / Test": a reusable test runner every
 * future capability registers its assertions with. Replaces the copy-pasted
 * ad-hoc t() checker of build 0003.
 *
 * Design constraints (same discipline as core/heartbeat.js):
 *  - No dependencies. DOM optional (renderTo is guarded).
 *  - Injectable clock, so results are deterministic under test.
 *  - A results record, once produced by run(), is deep-frozen — verification
 *    history is never mutated after the fact.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createVerifier = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function fail(message) {
    var e = new Error(message);
    e.name = "AssertionError";
    throw e;
  }

  function show(v) {
    if (typeof v === "string") return '"' + v + '"';
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  function deepEq(a, b) {
    if (a === b) return true;
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
      if (!deepEq(a[ka[i]], b[ka[i]])) return false;
    }
    return true;
  }

  var assert = {
    ok: function (v, msg) {
      if (!v) fail((msg || "assert.ok") + " — expected truthy, got " + show(v));
    },
    equal: function (a, b, msg) {
      if (a !== b) fail((msg || "assert.equal") + " — expected " + show(b) + ", got " + show(a));
    },
    deepEqual: function (a, b, msg) {
      if (!deepEq(a, b)) fail((msg || "assert.deepEqual") + " — expected " + show(b) + ", got " + show(a));
    },
    throws: function (fn, msg) {
      var threw = false;
      try { fn(); } catch (e) { threw = true; }
      if (!threw) fail((msg || "assert.throws") + " — expected function to throw, it did not");
    }
  };

  function deepFreeze(obj) {
    if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
    }
    return obj;
  }

  function createVerifier(options) {
    options = options || {};
    var name = options.name || "unnamed suite";
    var now = options.now || function () { return Date.now(); };
    var tests = [];

    function test(description, fn) {
      if (typeof description !== "string" || !description) throw new TypeError("test requires a description string");
      if (typeof fn !== "function") throw new TypeError("test requires a function");
      tests.push({ description: description, fn: fn });
      return api; // chainable
    }

    function run() {
      var startedAt = now();
      var results = [];
      var passed = 0, failed = 0;
      for (var i = 0; i < tests.length; i++) {
        var t = tests[i];
        var entry = { description: t.description, ok: true, error: null, at: null };
        try { t.fn(assert); passed++; }
        catch (e) { entry.ok = false; entry.error = String(e && e.message ? e.message : e); failed++; }
        entry.at = now();
        results.push(entry);
      }
      var record = {
        name: name,
        startedAt: startedAt,
        finishedAt: now(),
        total: tests.length,
        passed: passed,
        failed: failed,
        verdict: (failed === 0 && tests.length > 0) ? "PASS" : "FAIL",
        tests: results
      };
      return deepFreeze(record); // verification history is immutable
    }

    function renderTo(element) {
      if (!element || typeof element.appendChild !== "function") {
        throw new TypeError("renderTo requires a DOM element");
      }
      var record = run();
      var doc = element.ownerDocument;
      var table = doc.createElement("table");
      var head = table.insertRow();
      ["#", "Test", "Result"].forEach(function (h) {
        var th = doc.createElement("th"); th.textContent = h; head.appendChild(th);
      });
      record.tests.forEach(function (t, i) {
        var row = table.insertRow();
        row.insertCell().textContent = String(i + 1);
        row.insertCell().textContent = t.description + (t.error ? "  [" + t.error + "]" : "");
        var c = row.insertCell();
        c.textContent = t.ok ? "PASS" : "FAIL";
        c.className = t.ok ? "pass" : "fail";
      });
      var banner = doc.createElement("div");
      banner.className = "verdict " + (record.verdict === "PASS" ? "pass" : "fail");
      banner.textContent = record.verdict === "PASS"
        ? "✅ " + record.name + " — ALL " + record.total + " PASS. Release permitted."
        : "❌ " + record.name + " — " + record.failed + " of " + record.total + " FAILED. Release forbidden.";
      element.appendChild(table);
      element.appendChild(banner);
      return record;
    }

    var api = { test: test, run: run, renderTo: renderTo, assert: assert };
    return api;
  }

  createVerifier.assert = assert;
  return createVerifier;
});
