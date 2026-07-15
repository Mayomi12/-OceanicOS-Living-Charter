# The OceanicOS Ω∞ Handbook

*Guides, tutorials, workflows.*

## Sixty-second start

1. Clone the repository.
2. Open **[`index.html`](../index.html)** in any browser — the Gate. It verifies itself on load.
3. Click the single green light, **[`core/verify-all.html`](../core/verify-all.html)** — watch all
   59 capability suites run and issue one verdict.

No install, no server. Everything below happens in the browser.

## Guide 1 — the founding loop, by hand

Open the browser console on any page that has loaded the core scripts (or use the Flagship):

```js
var os = OceanicCore.createOceanic({}); os.start();
var o = os.reality.observe({ observation: "the tide turned at six", source: "you" });
os.reality.verify(o.meta.oid);                     // reality is checked before it is trusted
var d = os.decisions.propose({ question: "log it?", options: ["yes","no"], grounds: [o.meta.oid] });
os.decisions.decide(d.meta.did, "yes");            // commits only because the ground is verified
os.knowledge.learn({ statement: "tides here turn near six", topics: ["tides"], grounds: [o.meta.oid] });
```

Try to `decide` on a *pending* observation and it will refuse — verification before acceptance.

## Guide 2 — learn the loop the system's own way

```js
var E = OceanicCore.createEducation();
var s = E.enroll("first-drop");        // a lesson on a real ocean
s.current();                            // what to do next
// do the work in s.oceanic, then:
s.attempt();                            // advances only when the work actually stands
```

You advance by doing, never by clicking "next"; a wrong step earns a gentle hint. See
[`core/education.js`](../core/education.js).

## Guide 3 — the Flagship (the full stack in one page)

Open **[`core/omega.html`](../core/omega.html)**:

1. **Take the helm** — enter a name and role; you become an actor (anonymous callers cannot write).
2. **Work the ocean** — `observe the tide is rising`, then `verify <id>`, then `search tide`.
3. **Watch the instruments** — grade, gate, chores, governance update live.
4. **Govern** — run one improvement cycle; the loop files a proposal; you (a steward) ratify it.
5. **Seal** — one click produces a fixity-verified archive of the whole ship.

It persists in your browser — close it, come back, the ship remembers.

## Guide 4 — the Tokenization Studio

Open **[`core/studio.html`](../core/studio.html)** (root: Karpathy's minbpe): paste a corpus, choose
a vocabulary size, **Train**, then type text and watch it become token chips with a live
compression ratio and round-trip check. Export the trained tokenizer as JSON and carry it away.

## Guide 5 — prove a new implementation Compatible

Build OceanicOS in any language, then:
```js
OceanicCore.createCompatibility().report({
  level: 3,
  createMemory:  function(){ return myImpl.createMemory(); },
  createOceanic: function(){ return myImpl.createKernel(); },
  verification:  { beacon: true, suite: "my/verify-all.html" }
});
```
Green means "OceanicOS Compatible." See [SPECIFICATION.md](../SPECIFICATION.md).

## Workflow — contributing a drop

The full path is [CONTRIBUTING.md](../CONTRIBUTING.md). In one breath: **one capability per
contribution** — `core/<name>.js` + `core/<name>.verify.html` (with the beacon, ~11 tests, page
audits accessible) + three lines (manifest, ledger, tracker). Nothing is recorded before its suite
passes in a browser; run [`core/verify-all.html`](../core/verify-all.html) twice — a flaky test is a
defect. Then offer it; anyone may review; a steward accepts; your first accepted drop makes you a
contributor, on the record.

## Troubleshooting

- **A `file://` iframe can't read the child DOM.** That's why every verify page posts the beacon —
  Continuous Verification aggregates by message, never by DOM reads.
- **A suite "fails" only under the aggregator, not alone.** Suspect a flaky assertion (e.g. a
  single-digit search token matching random ids). Run it repeatedly; fix the fixture, not the engine.
- **`createOmega` / an engine "needs X".** Load the named core module first, or pass it in — the
  error names exactly what is missing.

**Continue.** ∞
