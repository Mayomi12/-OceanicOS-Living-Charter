/*
 * Ω∞ OceanicOS :: Continuous Verification runner (for CI)
 * Build 0078 · Stage 2 (Builder) — the honest CI entry point.
 *
 * OceanicOS is zero-runtime browser JavaScript: its truth is the in-browser
 * Continuous Verification page (core/verify-all.html, build 0013), which runs
 * EVERY capability's suite in turn and issues one verdict. This script is the
 * thinnest possible bridge so the same green light shows on GitHub: it opens
 * that page in a real headless Chromium, waits for the aggregate verdict, and
 * exits 0 (all suites pass) or 1 (any suite fails, or none reported — silence
 * is not success). It asserts nothing itself; the verified capabilities do all
 * the work. CI is honest only when it runs the real verification.
 *
 * Usage:  node ci/verify.js
 *   Browser: Playwright's bundled Chromium by default; set CHROME=<path> to
 *   point at an already-installed binary (used by the local dev environment).
 */
"use strict";
const path = require("path");

(async () => {
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) {
    console.error("playwright is not installed — run `npm ci` (or `npm i playwright`) and `npx playwright install --with-deps chromium` first.");
    process.exit(2);
  }

  const launchOpts = process.env.CHROME ? { executablePath: process.env.CHROME } : {};
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  const target = "file://" + path.resolve(__dirname, "..", "core", "verify-all.html");
  await page.goto(target);

  // wait until the aggregate verdict stops saying "running"
  await page.waitForFunction(() => {
    const v = document.getElementById("verdict");
    return v && !/run/.test(v.className) && v.textContent && !/running/.test(v.textContent);
  }, { timeout: 60000 }).catch(() => {});

  const title = await page.title();
  const verdict = await page.$eval("#verdict", (el) => el.textContent).catch(() => "(no verdict element)");
  const rows = await page.$$eval("#results tr", (rs) =>
    rs.slice(1).map((r) => Array.from(r.cells).map((c) => c.textContent))
  );

  console.log("TITLE:  ", title);
  console.log("VERDICT:", verdict);
  console.log("SUITES: ", rows.length);
  const failed = rows.filter((r) => r[5] === "FAIL");
  if (failed.length) {
    console.log("FAILED SUITES:");
    failed.forEach((r) => console.log("  - " + r.slice(0, 3).join(" ") + "  (pass " + r[3] + " / fail " + r[4] + ")"));
  }
  if (pageErrors.length) console.log("PAGE ERRORS:", JSON.stringify(pageErrors));

  await browser.close();

  const green = rows.length > 0 && failed.length === 0 && /✅/.test(title) && !/❌/.test(verdict);
  if (!green) { console.error("Continuous Verification did NOT pass — release forbidden."); process.exit(1); }
  console.log("Continuous Verification passed — every capability suite is green.");
  process.exit(0);
})().catch((e) => { console.error("runner error:", e && e.message ? e.message : e); process.exit(2); });
