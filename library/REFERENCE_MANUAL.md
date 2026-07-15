# The OceanicOS Ω∞ Reference Manual

*Architecture, runtime, APIs.*

The normative contract is [SPECIFICATION.md](../SPECIFICATION.md); this manual is the practical
companion. Everything below is zero-runtime: plain JavaScript that runs in any browser (and Node),
no dependencies, no build step.

## Architecture at a glance

```
                         ┌─────────────── one Memory Ocean (append-only) ───────────────┐
   Reality ─ Decisions ─ Knowledge ─ Projects ─ Build Registry     (Core, Stage 1)      │
        │        │          │                                                            │
   Search · Graph · Reasoning · Planning · Learning · Recommendation · Simulation ·      │
   Evaluation                                                        (Intelligence, S4)  │
        │                                                                                │
   Identity · Permissions · Workspaces · Teams · Orgs · Communities · Shared Knowledge · │
   Governance                                                        (Collaboration, S5) │
        │                                                                                │
   Sync · Monitoring · CI/CD · Deployment · Containers               (Infrastructure,S6) │
        │                                                                                │
   Templates · Education · Developer Platform · Research · Commons   (Ecosystem, S7)     │
        │                                                                                │
   Security · Privacy · Migration · Preservation · Accessibility ·                       │
   Maintenance · Continuous Improvement                              (Stewardship, S8)   │
        └────────────────────────────────────────────────────────────────────────────────┘
```

Every engine reads and writes the **same** ocean, each keyed to its own record `type`. Persist that
one Memory and the entire system persists.

## Booting the kernel

```js
// load the core scripts, then:
var os = OceanicCore.createOceanic({});     // or { storage: localStorage } to persist
os.start();
os.reality; os.decisions; os.knowledge; os.projects; os.builds;   // the engines
```

## Booting the whole ship (the Flagship)

```js
var ship = OceanicCore.createOmega({ storage: localStorage, quorum: 1 });
ship.identity.register({ name: "Kai", role: "steward", id: "kai" });
ship.identity.signIn("kai");
ship.api.call("reality.observe", { observation: "the tide is rising", source: "kai" });
ship.dashboard();   // one pure snapshot: helm · ocean · reality · grade · gate · chores · governance
```

`createOmega` assembles kernel · Identity · the permission-gated API · Governance · Monitor ·
Maintenance · Continuous Improvement · Search · Privacy · Preservation. See
[`core/omega.js`](../core/omega.js) and the live app [`core/omega.html`](../core/omega.html).

## The stable API (build 0017)

`createAPI({ oceanic })` returns `{ call, describe, operations }`. Every call returns
`{ ok, data, error }` and **never throws**. Operations include `reality.observe/verify/reject/list`,
`decision.propose/decide/list`, `knowledge.learn/list`, `project.open/link/list`, `builds.list`,
`system.status`, `snapshot`. `describe()` returns a machine-readable manifest (rendered for humans by
[`core/docs.html`](../core/docs.html)).

Wrap it with Permissions for a gated surface:
```js
var perms = OceanicCore.createPermissions({ identity: I, anonymous: null });  // no identity, no writes
var gated = perms.wrap(api);   // unauthorized calls refuse { ok:false }, never throw
```

## The record shape

Every record: `{ id, at, type, body, source, confidence, meta, supersedes }`. Its stable logical id
lives in `meta` (`oid`/`did`/`kid`/`pid`). Confidence is one of `certain · high · medium · low ·
speculation` — **confidence is never presented as certainty.**

## Status machines

- **Observation:** `pending → verified | rejected | archived` (archived terminal; no return to pending)
- **Decision:** `open → decided | rejected`; `decided → reversed`
- **Proposal:** `proposed → under-review → ratified | rejected | withdrawn`

## Interfaces shipped

Browser dashboard ([harbor.html](../core/harbor.html)) · REPL ([terminal.html](../core/terminal.html)) ·
windowed desktop ([desktop.html](../core/desktop.html)) · offline mobile ([mobile.html](../core/mobile.html)) ·
self-generated docs ([docs.html](../core/docs.html)) · tokenization studio ([studio.html](../core/studio.html)) ·
the Flagship ([omega.html](../core/omega.html)) · and the front page ([index.html](../index.html)),
which verifies itself on every load.

## Verification protocol

Every capability ships `core/<name>.verify.html`, run by the Verification Engine, setting
`document.title` ✅/❌ and posting `postMessage({ oceanicVerify: { name, verdict, total, passed,
failed } }, "*")`. [`core/verify-all.html`](../core/verify-all.html) drives them all into one verdict.
Prove your own implementation with `createCompatibility().report(candidate)` — see
[`core/compat.js`](../core/compat.js) and Specification §7.
