# The OceanicOS Ω∞ Living Charter

*Constitution, principles, governance.*

This volume is a **reader's companion** to the constitution — not the constitution itself. The
binding law lives in two documents at the repository root, and where this companion and those
documents differ, **they** govern:

- **[Ω∞ OceanicOS Living Charter.md](../Ω∞%20OceanicOS%20Living%20Charter.md)** — the ratified
  **operational** Charter (Seven Articles, v1.0.0). This is the law the code actually obeys.
- **[AGNOSTIC_CHARTER.md](../AGNOSTIC_CHARTER.md)** — the **Living Agnostic Charter** (Ω∞∞ Vision
  Edition), the platform-agnostic ecosystem vision; a companion to, never a replacement for, the
  ratified Charter. Its earlier revisions (Ω∞v, the thirteen Articles) are archived within it —
  nothing erased.

## The two unamendable laws

Above every article, two clauses cannot be amended by anyone:

1. **Humans hold final authority.** (Article I §3.) No role, team, organization, process, or AI in
   OceanicOS is authority over humans. Governance records decisions; humans enact them.
2. **History is never silently erased.** (Article III §2.) The Memory Ocean is append-only.
   Corrections supersede openly. The one lawful boundary at which content ever truly leaves is a
   verified [Migration](../core/migration.js) — and even that publishes a manifest of what was left
   behind.

## The Seven Articles, in brief

Identity · Truth · Memory · The Flow · Conduct · Stewardship · Amendment. The Charter is *living*:
it may grow and be amended, but only by the human operator, and only with an Amendment Log entry
recording version, date, and reason (Article VII). It is never silently rewritten — a rule this
repository has honored across all 70+ builds: the ratified Charter is byte-for-byte as it was
ratified on the first day.

## How the laws became code

The Charter is not a preamble the code ignores. Each law is enforced by a capability, and each is
verified:

| Charter principle | Enforced by | Verified in |
|-------------------|-------------|-------------|
| Verification before acceptance | Reality (0007) · Decisions (0008) — no commit on unverified ground | reality/decision suites |
| History never erased | Memory (0005) — no delete exists; `amend()` supersedes | memory suite; compat MEM-2/MEM-3 |
| Humans hold final authority | Permissions (0036) · Governance (0043) · Continuous Improvement (0062) | permissions/governance/improve suites |
| Change on purpose, reviewed | Governance (0043) — propose → review → ratify, quorum-gated | governance suite |
| Privacy & consent | Privacy (0057) — honest redaction, provenance preserved | privacy suite |
| Least privilege / security | Permissions (0036) · Security audit (0056) · Developer Platform (0053) | those suites |

## Governance in practice

A change is proposed with its rationale, impact, and plan; reviewed by any contributor (never your
own); and **ratified only with a quorum of endorsements and no standing objection** — constructive
disagreement blocks a rushed change until it is resolved. A ratified proposal is a *recorded
decision that humans then enact.* The system can propose changes to itself, but it can never ratify
them. See [`core/governance.js`](../core/governance.js) and the Commons ([`core/commons.js`](../core/commons.js)),
where a first accepted contribution turns a newcomer into a builder — on the record.

*The law is not what is written. The law is what is verified.*
