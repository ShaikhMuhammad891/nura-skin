# ADR-0005: Grounded LLM recommendations

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 12 §4, §7

## Context

An LLM left to itself will hallucinate products, ignore safety constraints and follow instructions injected through free text. The recommendation must be safe (pregnancy, allergies, conflicting actives) and always drawn from the catalogue.

## Decision

The pipeline is: deterministic normalization → safety screen → **SQL hard filters** → rule scoring → **deterministic draft routine** → the LLM reviews the draft and may swap **only within per-slot candidate lists** → validator → persist. Any failure falls back to the draft.

- The model never sees product IDs. It picks a `candidateIndex` (0–7) from a **static** structured-output schema, and the server maps the index to a variant (review R-01/R-02). See ADR-0012.
- The model has no tools, and free text is delimited as data.
- The validator re-checks structure, conflicts, budget, safety and the claims lexicon.

## Consequences

- ✅ The model's output cannot express an off-catalogue or unsafe product; there is always an answer.
- ⚠️ Recommendation quality depends on catalogue knowledge-base quality (efficacy, conflicts, pregnancy flags). This needs a domain review.
