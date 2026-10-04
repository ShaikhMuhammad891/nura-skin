# ADR-0012: AI model, effort and two-phase streamed output

- **Status:** Accepted in design; latency and cost numbers pending the M3.5 spike · **Date:** 2026-09-28 · **Refs:** 12 §4.6, §6.2, §11; review R-01

## Context

Writing explanations for three tiers takes far longer than an acceptable wait in a conversion funnel. A per-request JSON schema would defeat structured-output grammar caching and prompt caching.

## Decision

- **Model:** `claude-opus-5` via `AI_MODEL`, with adaptive thinking and `effort: "low"`, streaming, prompt caching on the static prefix, and server-side refusal fallback enabled. Moving to a faster model is a product decision based on eval results.
- **Static schema `finder-output.v2`**: phase A (selection: `recommendedTier`, per-slot `candidateIndex`, `decision`, `swapReasonCode`) is generated first; phase B (per-product rationale/usage, tier summaries, notes) second.
- **Deadlines:** phase A 10 s → whole-routine fallback; overall 30 s → per-step template fallback.
- After phase A validates, the routine renders with templated text (`result` event). Phase B replaces the text as it streams (`explanation` events).
- A leased Redis semaphore allows at most 20 in-flight calls, and `AI_DAILY_CALL_CAP = 400`.

## To be recorded after the M3.5 spike

Measured p50/p95 for phase A and phase B, cache read ratio, cost per consultation, eval pass rates, and whether a faster model meets the bar.
