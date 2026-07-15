# The OceanicOS Ω∞ Codex

*Knowledge models, patterns, terminology.*

## The universal record

Everything OceanicOS knows is one shape — a record in the append-only Memory Ocean:

| Field | Meaning |
|-------|---------|
| `id` | unique storage id |
| `at` | timestamp |
| `type` | `observation`·`decision`·`knowledge`·`project`·`build`·`actor`·`team`·`workspace`·`org`·`community`·`proposal`·`release`·`deployment`·`app`·`inquiry`·`lesson`·`migration` |
| `body` | human-readable content (non-empty) |
| `source` | provenance — never fabricated |
| `confidence` | `certain · high · medium · low · speculation` |
| `meta` | typed metadata: status, logical id, grounds, links |
| `supersedes` | the id this record corrects, or `null` |

## Recurring patterns (the house style)

- **Compose, never reinvent.** New capabilities stand on existing engines; new state is a new
  record `type` in the one ocean, never a second store.
- **Append-only.** No `delete`/`forget`/`clear` exists anywhere. Corrections are open `amend()`s that
  set `supersedes`; current reads exclude superseded records, history retains them.
- **Refuse loudly, with the reason and the fix.** Guards throw on misuse; runtime refusals return
  `{ ok:false, error }`; audits report findings that each carry a severity *and* a fix.
- **State the limit.** Where a capability cannot honestly promise something (cryptographic erasure,
  adversarial security, sufficiency of mechanical checks), it says so — in its header and its output.
- **Grounding.** A conclusion cites its grounds; a decision or knowledge record may not rest on an
  unverified observation. The Reasoner propagates soundness up these links.
- **Live lenses.** Search, Graph, Reasoning, Recommendation, Shared Knowledge, Monitoring, the
  Maintenance sweep — all *derive* from current reality and write nothing. Re-examine reality and
  they change their minds automatically.

## Soundness (the Reasoner's vocabulary)

`sound` (all grounds verified) · `provisional` (some not yet verified) · `unsound` (rests on a
rejected ground) · `broken` (a cited ground is missing) · `ungrounded` (cites nothing). See
[`core/reason.js`](../core/reason.js).

## Compatibility levels

`1 Memory-compatible` (record shape · append-only · open supersession) → `2 Kernel-compatible`
(+ status machines · verification-before-acceptance) → `3 Fully compatible` (+ the verification
beacon). Cumulative; tested by [`core/compat.js`](../core/compat.js).

## Glossary

- **Ocean / Memory** — the one append-only record store.
- **Drop** — a single verified contribution; also the unit of the doctrine ("take a drop, leave a drop").
- **Kai** — the orchestration runtime; augments, never authority.
- **Helm** — the currently signed-in actor (Identity session; runtime-only, never persisted).
- **Grounds** — the observations a decision or knowledge record cites.
- **Supersession** — the append-only correction: a new record declaring what it replaces.
- **Fixity** — a content digest (Preservation) that makes silent corruption detectable.
- **Gate** — the Monitor's release verdict; blocks on failures, warns on cautions.
- **Quorum** — the endorsements a governance proposal needs before a steward may ratify it.
- **Beacon** — the uniform `postMessage` a verify page posts so Continuous Verification can drive it.
- **BPE / minbpe** — the byte-pair tokenizer ([`core/tokenizer.js`](../core/tokenizer.js)), rooted in Karpathy's minbpe.

## Numbering law

Build numbers are strictly sequential and never reused — enforced inside the system by the Build
Registry (0006) and outside by [BUILD_LOG.md](../BUILD_LOG.md). A wrong drop is followed by a better
drop, or yanked openly with a reason (CI/CD 0048). It is never erased.
