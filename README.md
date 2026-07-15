# Ω♾️V :: ƆCEANiC_OS

> **Take a Drop. Leave a Drop. Return a Better Drop.**

**OceanicOS** is a knowledge & stewardship operating system built one verified capability at a
time — **57 capabilities, nine stages, all complete**, every one released only after its own
browser test suite passed. It runs with **zero runtime**: plain JavaScript in any browser, no
server, no build step, no dependencies.

| | |
|---|---|
| **The law** | [Ω∞ OceanicOS Living Charter](Ω∞%20OceanicOS%20Living%20Charter.md) — Seven Articles, v1.0.0, ratified. Humans hold final authority; history is never silently erased. |
| **The vision** | [VISION.md](VISION.md) · [AGNOSTIC_CHARTER.md](AGNOSTIC_CHARTER.md) — the platform-agnostic ecosystem charter (current + archived revisions) |
| **The standard** | [SPECIFICATION.md](SPECIFICATION.md) — the published contract behind "OceanicOS Compatible", with an executable checker ([core/compat.js](core/compat.js)) |
| **The ledger** | [BUILD_LOG.md](BUILD_LOG.md) — every build 0001–0062, its verification, its release hash |
| **The roadmap** | [BUILDER.md](BUILDER.md) — nine stages, all ✅ |
| **The library** | [library/](library/) — five companion volumes: the [Book](library/BOOK.md) · [Living Charter](library/LIVING_CHARTER.md) · [Reference Manual](library/REFERENCE_MANUAL.md) · [Codex](library/CODEX.md) · [Handbook](library/HANDBOOK.md) |

## Try it in sixty seconds

Clone, then open in any browser — no install, no server:

- **[`core/verify-all.html`](core/verify-all.html)** — the whole system's single green light: every capability's suite runs and one verdict is issued (currently **56/56 suites · 657 assertions · 0 failures**).
- **[`core/harbor.html`](core/harbor.html)** — the web dashboard · **[`core/terminal.html`](core/terminal.html)** — the REPL · **[`core/desktop.html`](core/desktop.html)** — the windowed workspace · **[`core/mobile.html`](core/mobile.html)** — the offline, persistent app · **[`core/docs.html`](core/docs.html)** — the self-generated API docs · **[`core/studio.html`](core/studio.html)** — the living BPE tokenization studio (root: Karpathy's minbpe; Basic ⇄ Regex) · **[`core/chronicle.html`](core/chronicle.html)** — the history explorer: a record's lineage, and the ocean's past states recovered by dragging through time · **[`core/omega.html`](core/omega.html)** — **Ω∞v, the Flagship**: the full stack in one page (helm, gated commands, live instruments, governance, the improvement loop, sealing), persistent on your device.

## What lives here

One append-only **Memory Ocean** ([core/memory.js](core/memory.js)) — no delete exists; corrections supersede openly — with engines composed over it:

- **Core** — reality (observations verified before trusted), decisions (refused on unverified grounds), knowledge, projects, the build registry.
- **Intelligence** — search, knowledge graph, reasoning (soundness propagation), planning, learning, recommendation, simulation, evaluation.
- **Collaboration** — identity, permissions (least privilege), workspaces, teams, organizations, communities, shared knowledge, and governance (propose → review → ratify; quorum-gated; objections block).
- **Infrastructure** — sync (diverged oceans reunite, conflicts surfaced never silently resolved), monitoring, CI/CD (nothing unhealthy ships), deployment (booted and proven before called deployed), containers.
- **Ecosystem** — plugins, templates (working starter oceans), education (learn-by-doing on a real ocean), a scoped & audited developer platform, research (findings graduate to knowledge only when evidence verifies), and the Commons (a first accepted drop makes an observer a contributor).
- **Stewardship** — security & accessibility audits (findings carry their fix), privacy (honest redaction), migration (the one lawful boundary where content truly leaves), preservation (fixity-sealed archives), maintenance (the standing chore list), and **continuous improvement** — the system observes itself, suggests one improvement, and files it with governance. It proposes; humans decide.

## Build with it

```js
// any page, any browser — load the core scripts, then:
var os = OceanicCore.createOceanic({});      // one kernel, one ocean
os.start();
var o = os.reality.observe({ observation: "the tide turned at six", source: "you" });
os.reality.verify(o.meta.oid);               // reality is checked before it is trusted
os.decisions.propose({ question: "log it?", options: ["yes","no"], grounds: [o.meta.oid] });
```

Start from a working shape with **Templates** (`createTemplates`), learn the loop with **Education** (`createEducation().enroll("first-drop")`), or prove your own implementation **OceanicOS Compatible** against the [Specification](SPECIFICATION.md).

## The doctrine

Every build: **Observe · Verify · Build one capability · Test · Record · Release · Continue.**

> **Never build everything.**
> **Always build the next verified capability that leaves reality better than before.**
> **Continue.** ∞

---

## Provenance

This repository began as the public harbor of the Living Charter alone (the Charter lives natively in the OCEANICOS Obsidian vault, where `[[wikilinks]]` resolve to the system it governs — Kai, the Memory Ocean, the Drop → Wisdom flow). The system described above was then built here, drop by drop, under that Charter — see the [ledger](BUILD_LOG.md) for every one.

`Ω♾️V :: ƆCEANiC_OS` · Operator: **Kai** · `RUN` 💧
