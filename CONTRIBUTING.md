# Contributing to Ω∞ OceanicOS

> **Take a Drop. Leave a Drop. Return a Better Drop.**

The system you are contributing to already models its own contribution flow — the Commons
([core/commons.js](core/commons.js), build 0055): the door is open, anyone may offer and review,
acceptance is a steward's act, and a first accepted drop makes an observer a contributor. This
document is that flow, written for humans working on this repository.

## The doctrine — every contribution follows it

**Observe · Verify · Build ONE capability · Test · Record · Release · Continue.**

One drop per contribution. Never build everything. A contribution that tries to change many things
at once will be asked to become several.

## What a drop looks like

A capability is **two files plus three lines**:

1. **`core/<name>.js`** — the capability. House invariants (all enforced by the existing 58; read
   any recent one, e.g. [core/maintenance.js](core/maintenance.js), before writing yours):
   - **Zero-runtime UMD** on the shared `OceanicCore` namespace — runs in a plain browser, no
     dependencies, no build step. `module.exports` for Node, injectable clock (`now`) for
     deterministic tests.
   - **Compose, never reinvent** — build on the engines that exist. New storage goes in the one
     Memory Ocean ([core/memory.js](core/memory.js)) as a new record `type`, **append-only**: no
     delete anywhere, corrections are open `amend()`s, history is never erased.
   - **Refuse loudly, with the reason and the fix** — guards throw for misuse; runtime refusals
     return `{ ok:false, error }`; audits report findings that carry their severity **and** their fix.
   - **State your limits** — if the capability cannot honestly promise something (cryptographic
     erasure, adversarial security, sufficiency of mechanical checks), it says so in its header
     and, where it matters, in its output.
   - A top-of-file comment explaining **why the capability exists**, in the voice of the others.
2. **`core/<name>.verify.html`** — the suite, ~11 tests, run **by the Verification Engine**
   (`OceanicCore.createVerifier`). It must: exercise the guards AND the happy path AND the refusals;
   include a **live proof panel** (real behavior on the page, not just assertions); set
   `document.title` to `✅ …` / `❌ …`; and post the uniform beacon so Continuous Verification can
   drive it:
   ```js
   window.parent.postMessage({ oceanicVerify: { name, verdict, total, passed, failed } }, "*");
   ```
   The page itself must audit **accessible** ([core/accessibility.js](core/accessibility.js)) —
   `lang`, `title`, labels, names, heading order. The Gate holds every page to this.
3. **Three lines elsewhere**: a `MANIFEST` entry in [core/verify-all.html](core/verify-all.html);
   a row in [BUILD_LOG.md](BUILD_LOG.md) (take the next build number — see numbering below — and
   pin the previous row's "this commit" to its now-known hash); and, if a stage tracker line
   applies, [BUILDER.md](BUILDER.md).

## The gate a drop must pass

**Nothing is recorded, committed, or released before its suite passes in a real browser.** Then the
whole system must stay green: open [core/verify-all.html](core/verify-all.html) and every suite —
including yours — must PASS. Run it **twice**; a flaky test is a defect (we have caught several of
our own this way; the checkers are usually right and the fixture is usually wrong). If your change
is documentation-only, the gate is: every link resolves, and CV is unchanged.

## Numbering, ledger, and history

- Build numbers are **strictly sequential** and never reused (the Build Registry, 0006, enforces
  this law inside the system; the ledger keeps it outside).
- The ledger row states **what** the capability is, **what law it upholds**, **how it was
  verified** (test count + CV totals), and its release hash.
- Never rewrite history — in the ocean, in the ledger, or in git. A wrong drop is followed by a
  better drop (or yanked openly with a reason, per CI/CD 0048); it is not erased.

## The law above all of it

The ratified **[Ω∞ OceanicOS Living Charter](Ω∞%20OceanicOS%20Living%20Charter.md)** (Seven
Articles, v1.0.0) governs every contribution. Two clauses are unamendable and non-negotiable in
review: **humans hold final authority**, and **history is never silently erased**. Nothing you
build may enact its own ideas past a human gate, claim certainty it has not earned, or delete what
was known. Vision documents ([AGNOSTIC_CHARTER.md](AGNOSTIC_CHARTER.md), [VISION.md](VISION.md))
guide direction; where they differ from the ratified Charter, the Charter governs.

## Review, in the Commons' spirit

Offer the drop (a pull request), say plainly **what it does and what law it upholds**. Anyone may
review; never approve your own. A standing objection blocks acceptance until resolved — constructive
disagreement is a feature, not an obstacle. Acceptance is a steward's act. A declined drop is told
why. Your first accepted drop makes you a contributor — on the record.

*Learn the loop by doing it first: enroll in the built-in lesson —
`OceanicCore.createEducation().enroll("first-drop")` — and let the ocean itself teach you
observe → verify → decide → learn.*

---

**Never build everything. Always build the next verified capability that leaves reality better
than before. Continue.** ∞
