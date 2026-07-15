/*
 * Ω∞ OceanicOS :: Accessibility
 * Build 0060 · Stage 8 (Stewardship) · zero-runtime (plain browser)
 *
 * The Charter's stewardship includes the people at the glass: a system that
 * cannot be perceived or operated by everyone is not "making expertise more
 * accessible". Accessibility is the audit made a capability — pure checks
 * over any Document (this system ships eight HTML applications and fifty
 * verification pages; they must answer for themselves):
 *
 *   A11Y-LANG      the document declares its language
 *   A11Y-TITLE     the document has a title (the screen reader's first words)
 *   A11Y-ALT       every image has an alt attribute (alt="" marks decorative)
 *   A11Y-LABELS    every form control has an accessible label
 *   A11Y-NAMES     every button and link has an accessible name
 *   A11Y-HEADINGS  the heading outline never skips a level
 *   A11Y-FRAMES    every iframe has a title saying what lives inside it
 *
 *   audit(doc) → { findings, passed, score, posture, headline } — same shape
 *   as Security (0056): every finding carries its severity AND its fix, the
 *   posture ladder is accessible → usable → excluding, and the audit never
 *   mutates the page it reads.
 *
 * Like every audit here, it reports; fixing is a human's act. And like every
 * limit here, this one is stated: these are the mechanical checks a machine
 * can make honestly — they are necessary, not sufficient. Real accessibility
 * is confirmed by people, with assistive technology, not by a score.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OceanicCore = root.OceanicCore || {}, root.OceanicCore.createAccessibility = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createAccessibility() {

    function sel(el) {
      var s = el.tagName.toLowerCase();
      if (el.id) return s + "#" + el.id;
      var cls = (el.getAttribute && el.getAttribute("class")) || "";
      return cls ? s + "." + cls.split(/\s+/)[0] : s;
    }
    function textOf(el) { return (el.textContent || "").replace(/\s+/g, " ").trim(); }
    function accessibleName(el) {
      return textOf(el) ||
        (el.getAttribute("aria-label") || "").trim() ||
        (el.getAttribute("title") || "").trim() ||
        (el.getAttribute("alt") || "").trim();
    }
    function labelled(doc, control) {
      if ((control.getAttribute("aria-label") || "").trim()) return true;
      if (control.getAttribute("aria-labelledby")) return true;
      if (control.getAttribute("type") === "hidden") return true;
      if (control.id && doc.querySelector('label[for="' + control.id + '"]')) return true;
      var p = control.parentNode;
      while (p && p.tagName) { if (p.tagName.toLowerCase() === "label") return true; p = p.parentNode; }
      return false;
    }

    function audit(doc) {
      if (!doc || typeof doc.querySelectorAll !== "function" || !doc.documentElement) {
        throw new TypeError("audit requires a Document (window.document, or DOMParser output)");
      }
      var out = [];
      function finding(id, name, severity, offenders, detail, fix) {
        out.push({ id: id, name: name, verdict: "finding", severity: severity,
                   count: offenders.length || null,
                   sample: offenders.length ? sel(offenders[0]) : null,
                   detail: detail, fix: fix });
      }
      function pass(id, name, detail) {
        out.push({ id: id, name: name, verdict: "pass", severity: null, count: null, sample: null, detail: detail, fix: null });
      }

      // LANG
      var lang = (doc.documentElement.getAttribute("lang") || "").trim();
      if (!lang) finding("A11Y-LANG", "the document declares its language", "high", [],
        "no lang attribute — screen readers must guess the pronunciation rules",
        'set <html lang="…">');
      else pass("A11Y-LANG", "the document declares its language", 'lang="' + lang + '"');

      // TITLE
      var title = (doc.title || "").trim();
      if (!title) finding("A11Y-TITLE", "the document has a title", "high", [],
        "no <title> — the screen reader's first words are silence",
        "give the page a descriptive <title>");
      else pass("A11Y-TITLE", "the document has a title", '"' + title.slice(0, 60) + '"');

      // ALT
      var badImgs = [].filter.call(doc.querySelectorAll("img"), function (img) { return !img.hasAttribute("alt"); });
      if (badImgs.length) finding("A11Y-ALT", "every image has an alt attribute", "high", badImgs,
        badImgs.length + " image(s) with no alt at all — invisible to a screen reader, unnameable to everyone",
        'describe the image in alt="…", or mark it decorative with alt=""');
      else pass("A11Y-ALT", "every image has an alt attribute", doc.querySelectorAll("img").length + " image(s), all attributed");

      // LABELS
      var controls = doc.querySelectorAll("input, select, textarea");
      var unlabelled = [].filter.call(controls, function (c) { return !labelled(doc, c); });
      if (unlabelled.length) finding("A11Y-LABELS", "every form control has a label", "high", unlabelled,
        unlabelled.length + " control(s) with no accessible label — a blank to anyone who cannot see the layout",
        "attach a <label for>, wrap in <label>, or set aria-label");
      else pass("A11Y-LABELS", "every form control has a label", controls.length + " control(s), all labelled");

      // NAMES
      var actionable = doc.querySelectorAll("button, a[href]");
      var nameless = [].filter.call(actionable, function (el) { return !accessibleName(el); });
      if (nameless.length) finding("A11Y-NAMES", "every button and link has a name", "high", nameless,
        nameless.length + " actionable element(s) announce as just 'button' or 'link'",
        "give it text content, aria-label, or a title");
      else pass("A11Y-NAMES", "every button and link has a name", actionable.length + " actionable element(s), all named");

      // HEADINGS
      var headings = doc.querySelectorAll("h1,h2,h3,h4,h5,h6");
      var skips = [];
      var prev = 0;
      [].forEach.call(headings, function (h) {
        var level = parseInt(h.tagName.slice(1), 10);
        if (prev > 0 && level > prev + 1) skips.push(h);
        prev = level;
      });
      if (skips.length) finding("A11Y-HEADINGS", "the heading outline never skips a level", "medium", skips,
        skips.length + " heading(s) skip a level — the outline a screen-reader user navigates by has holes",
        "step down one level at a time (h2 after h1, not h4)");
      else pass("A11Y-HEADINGS", "the heading outline never skips a level", headings.length + " heading(s), well nested");

      // FRAMES
      var frames = doc.querySelectorAll("iframe");
      var untitled = [].filter.call(frames, function (f) { return !(f.getAttribute("title") || "").trim(); });
      if (untitled.length) finding("A11Y-FRAMES", "every iframe says what lives inside it", "medium", untitled,
        untitled.length + " iframe(s) with no title — an unlabeled door",
        'set title="…" on the iframe');
      else pass("A11Y-FRAMES", "every iframe says what lives inside it", frames.length + " iframe(s), all titled");

      var findings = out.filter(function (c) { return c.verdict === "finding"; });
      var passed = out.filter(function (c) { return c.verdict === "pass"; });
      var high = findings.filter(function (f) { return f.severity === "high"; }).length;
      var medium = findings.length - high;
      var score = Math.max(0, 100 - high * 25 - medium * 10);
      var posture = high > 0 ? "excluding" : medium > 0 ? "usable" : "accessible";
      return {
        findings: findings, passed: passed, checks: out,
        score: score, posture: posture,
        note: "mechanical checks only — necessary, not sufficient; real accessibility is confirmed by people with assistive technology",
        headline: posture === "accessible"
          ? "ACCESSIBLE — " + passed.length + "/" + out.length + " checks pass (score " + score + ")"
          : posture.toUpperCase() + " — " + findings.map(function (f) { return f.id; }).join(", ") + " (score " + score + ")"
      };
    }

    return { audit: audit };
  }

  return createAccessibility;
});
