# ADR-0021: Ship the Routine Finder on the rules engine first

- **Status:** Accepted · **Date:** 2026-10-04 · **Refs:** 12 §4, §8; ADR-0012

## Context

The finder's design pairs a deterministic engine (safety, candidates, scoring, assembly, templated
explanations) with a Claude selection/explanation phase. There is no Anthropic key yet (no paid
services for now), but the engine, validator and fallback copy are built and tested.

## Decision

- Ship the full finder now on the deterministic path, which is exactly the designed fallback
  (12 §8): consultations persist with `engine = RULES_FALLBACK`, `fallbackReason = "llm_disabled"`,
  rationales `rationaleSource = TEMPLATE`.
- Server Actions (ADR-0017) instead of the SSE `/recommend` route: the rules engine answers in
  milliseconds, so the "analyzing" screen paces the real pipeline stages client-side.
- Persistence is batched (one insert for tiers, one for steps, one update) under a row lock
  (`SELECT … FOR UPDATE`), so double submits serialize and the transaction stays short far from
  the database.
- Guests own consultations through a signed `nura_consult` cookie; `/auth/complete` claims them.

## Consequences

- ✅ The headline feature works end to end today, safely, at zero cost.
- ✅ The LLM phase plugs in later without schema changes (columns for engine, model, tokens,
  prompt version and raw output already exist); the SSE route can be added alongside.
- ⚠️ Swap alternatives, shade choice (`requiresVariantChoice`), emailing a routine and
  `CustomerPreference` sync are not built yet.
