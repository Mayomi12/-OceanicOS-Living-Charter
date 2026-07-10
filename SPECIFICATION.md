# Ω∞ OceanicOS Specification v1.0

> The published standards behind **"OceanicOS Compatible"** — the technical contract the
> [Living Agnostic Charter](AGNOSTIC_CHARTER.md) calls for. Requirements marked with an id
> (`MEM-1`, `KRN-2`, …) are **executable**: [`core/compat.js`](core/compat.js) (build 0045) tests
> them and returns a verdict, and [`core/compat.verify.html`](core/compat.verify.html) proves the
> checker itself. The reference implementation is this repository; compatibility is behavioral —
> any implementation, in any language, that meets the contract may claim it.
>
> Keywords **MUST**, **MUST NOT**, **SHOULD** are used in the RFC 2119 sense. The ratified
> operational **[Ω∞ OceanicOS Living Charter](Ω∞%20OceanicOS%20Living%20Charter.md)** (v1.0.0)
> governs above this document.

---

## 1. The Record

Everything an OceanicOS knows is a **record** in one shared, append-only store (the *Memory Ocean*).

A record MUST carry:

| Field | Meaning |
|-------|---------|
| `id` | unique storage id |
| `at` | timestamp |
| `type` | what kind of thing this is (`observation`, `decision`, `knowledge`, `project`, `build`, `actor`, `team`, `workspace`, `org`, `community`, `proposal`, …) |
| `body` | the human-readable content (non-empty) |
| `source` | provenance — where this came from (`null` allowed, never fabricated) |
| `confidence` | one of `certain · high · medium · low · speculation` — confidence is never presented as certainty |
| `meta` | typed metadata (status, logical id, grounds, …) |
| `supersedes` | the id of the record this one corrects, or `null` |

**Logical ids.** A record's stable identity across amendments lives in `meta`: `oid` (observation),
`did` (decision), `kid` (knowledge), `pid` (project/proposal), slug ids for collaboration types.
Reference: [`core/memory.js`](core/memory.js) (0005).

- **MEM-1** — Records MUST round-trip with provenance: `remember()` → `recall()` preserves
  `type`, `body`, `source`, `confidence` and `meta`.

## 2. The Memory contract — append-only

- **MEM-2** — No destructive operation may exist on Memory. There MUST be no
  `delete`/`forget`/`clear`/`remove`/`erase`/`purge`/`drop`. History is never erased.
- **MEM-3** — Corrections MUST be **open supersession**: `amend(id, entry)` appends a new record
  declaring what it supersedes. Current reads exclude the superseded version; the superseded record
  MUST remain retrievable (via `get(id)`, a `timeline()`, or `recall({ includeSuperseded: true })`).
- Current reads SHOULD surface only current records by default; an already-superseded record MUST
  NOT be amended again (amend the superseding one).

## 3. The Kernel — status machines and the grounding rule

An implementation claiming kernel compatibility MUST assemble its engines over **one** shared
Memory and expose it (`oceanic.memory`), so history is auditable.

**Observation lifecycle** ([`core/reality-engine.js`](core/reality-engine.js), 0007):

```
pending → verified | rejected | archived
```

- **KRN-1** — Fresh observations MUST start `pending`. `verified` and `archived` transitions MUST
  work as above; there is no return to `pending`, and `archived` is **terminal** — further
  transitions MUST be refused.
- **KRN-3** — Every status transition MUST be preserved as history (an open amendment): after a
  transition, the pre-transition record still exists in the ocean.

**Verification before acceptance** ([`core/decision-engine.js`](core/decision-engine.js), 0008):

- **KRN-2** — A decision MUST NOT commit (`decide`) while any cited ground (observation) is not
  `verified`. Proposing with pending grounds is allowed; committing on them is not.

**Other status machines** (normative for implementations of those types):
decision `open → decided | rejected`, `decided → reversed`; proposal
`proposed → under-review → ratified | rejected | withdrawn` with ratification requiring an
endorsement quorum and zero standing objections ([`core/governance.js`](core/governance.js), 0043).

## 4. The verification protocol

Compatibility is not claimed, it is **demonstrated** — every capability ships a self-verifying suite.

- **VER-1** — An implementation MUST ship a verification suite and speak the uniform beacon so any
  aggregator can drive it:
  - the suite page sets `document.title` prefixed `✅` (all pass) or `❌`;
  - it posts `postMessage({ oceanicVerify: { name, verdict: "PASS"|"FAIL", total, passed, failed } }, "*")`
    to its parent;
  - **silence is failure** — a suite that reports nothing counts as failed.
- Reference aggregator: [`core/verify-all.html`](core/verify-all.html) (0013). An empty suite MUST
  NOT pass ([`core/verify-engine.js`](core/verify-engine.js), 0004).

## 5. Namespace & runtime

- Modules SHOULD be dependency-free UMD factories on a shared namespace (`OceanicCore` internal;
  `OceanicOS.create()` as the public SDK surface, [`core/sdk.js`](core/sdk.js) 0020).
- The reference profile is **zero-runtime**: everything runs in a plain browser. Other runtimes are
  welcome (agnosticism, Charter Art. III r1) — the contract is behavioral, not environmental.
- Clocks and id generators SHOULD be injectable for deterministic verification.

## 6. Human authority

- No role, team, organization, process, or AI in an OceanicOS is authority over humans. Governance
  records decisions; **humans enact them**. The ratified Charter's Article I §3 (human final
  authority) and Article III §2 (history never silently erased) are unamendable and bind every
  compatible implementation's conduct, whatever its code.

## 7. Compatibility levels

| Level | Name | Requirements |
|-------|------|--------------|
| 1 | **Memory-compatible** | MEM-1 · MEM-2 · MEM-3 |
| 2 | **Kernel-compatible** | Level 1 + KRN-1 · KRN-2 · KRN-3 |
| 3 | **Fully compatible** | Level 2 + VER-1 |

Levels are cumulative. An implementation may identify as **OceanicOS Compatible (Level N)** when
`createCompatibility().report(candidate)` returns `compatible: true` for its claimed level:

```js
var K = OceanicCore.createCompatibility();
K.report({
  level: 3,
  createMemory:  function () { return myImpl.createMemory(); },   // zero-arg factories:
  createOceanic: function () { return myImpl.createKernel(); },   // fresh instance per probe
  verification:  { beacon: true, suite: "my/verify-all.html" }
});
// → { compatible, claimed, achieved, passed, failed, checks: [{ id, level, requirement, verdict, detail }] }
```

The checker is **pure** — it probes fresh instances and writes nothing to any real ocean — and it
discriminates: a memory with a `delete()`, a memory that rewrites history, or a kernel that decides
on unverified grounds each fail exactly the requirement they break (proven in
[`core/compat.verify.html`](core/compat.verify.html)).

## 8. Versioning of this specification

This specification evolves by the Charter's governance: documented revisions with purpose, evidence,
expected impact, and compatibility considerations; earlier versions remain archived. Requirement ids
are stable — a future revision may add ids but MUST NOT silently change the meaning of an existing one.

---

*Specification version: 1.0 · reference implementation: this repository ([BUILD_LOG.md](BUILD_LOG.md)) ·
requirements list is generated from the same source the checker runs
(`createCompatibility().requirements()`).*
