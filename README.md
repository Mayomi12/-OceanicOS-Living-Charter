# Ω♾️V :: ƆCEANiC_OS

```
/
└── Ω∞ OceanicOS Living Charter
```

> **Take a Drop. Leave a Drop. Return a Better Drop.**

This repository is the public harbor of the **[Ω∞ OceanicOS Living Charter](Ω∞%20OceanicOS%20Living%20Charter.md)** — the founding, versioned, amendable law of **ƆCEANiC_OS**, a Living Second Brain whose companion is **Kai**.

It also carries the **[Ω∞ OceanicOS Living Agnostic Charter](Ω∞%20OceanicOS%20Living%20Agnostic%20Charter.md)** — the same seven-Article law restated free of any single platform, vendor, model, metaphor, or persona, so any implementation can adopt it. It is derived from the native Charter; where the two conflict on principle, the native Charter is the source of truth.

## What the Charter is

- **Living, not stone** — it may grow and be amended, but never silently rewritten. Every change is recorded in its Amendment Log with a version, date, and reason.
- **Seven Articles** — Identity · Truth · Memory · The Flow · Conduct · Stewardship · Amendment.
- **Two unamendable clauses** — humans hold final authority, and history is never silently erased.

## Current version

| Charter | Version | Ratified | Status |
|---------|---------|----------|--------|
| Living Charter (native) | 1.0.0 | 2026-07-08 | LIVING |
| Living Agnostic Charter (Vision Ω∞∞V) | 2.0.1 | 2026-07-12 | LIVING |

## The system it governs

The Charter is not only text — a live, zero-runtime OceanicOS is built under it in [`core/`](core/), one verified capability at a time (see [BUILD_LOG.md](BUILD_LOG.md)). Every capability ships with a browser verification suite; [`core/verify-all.html`](core/verify-all.html) is the single green light (**23/23 suites, 288 assertions**).

The Vision Edition of the Agnostic Charter declares a **Root** — `minbpe` (Karpathy) — and a **Kernel**, the *Living Tokenization Studio*. That Root is now realized: [`core/studio.html`](core/studio.html) trains a byte-level BPE tokenizer, shows it learn, and reads it back — `decode(encode(text)) === text`, always. It offers two engines: the byte-level **Basic** tokenizer ([`core/tokenizer.js`](core/tokenizer.js), 0025) and a **GPT-style** one that splits on a regex before merging so tokens never cross word boundaries ([`core/regex-tokenizer.js`](core/regex-tokenizer.js), 0026) — with **special-token** boundary markers on top ([`core/special-tokens.js`](core/special-tokens.js), 0027), completing minbpe's Basic → Regex → special-tokens progression. A single front door, [`core/tokenization-sdk.js`](core/tokenization-sdk.js) (0028, namespace `OceanicTokenizers`), makes all three discoverable, self-describing, and comparable. And the [`core/tokenizer-vault.js`](core/tokenizer-vault.js) (0029) records trained models in the **Memory Ocean** with provenance — superseded openly by revision, never erased — so a tokenizer is knowledge the system keeps.

## Provenance

The Charter lives natively inside the OCEANICOS Obsidian vault, where `[[wikilinks]]` resolve to the system it governs (Kai, the Memory Ocean, the Drop → Wisdom flow). This repository mirrors it for the open water.

---

`Ω♾️V :: ƆCEANiC_OS` · Operator: **Kai** · `RUN` 💧
