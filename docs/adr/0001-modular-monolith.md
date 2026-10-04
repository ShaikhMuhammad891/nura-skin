# ADR-0001: Modular monolith on Next.js App Router

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 06 §1, 07

## Context

There is one developer and one deployable. The product needs a storefront, customer account, admin, webhooks, background jobs and an AI pipeline that share one domain model. Operational simplicity and end-to-end types matter more than independent scaling.

## Decision

Build a single Next.js (App Router) application deployed on Vercel, organized as **feature modules** under `src/features/<feature>`. Domain services live in `features/*/server/service.ts`, import `server-only`, and never use Next.js request APIs (`cookies`, `revalidateTag`). They can therefore be called from Server Actions, route handlers, webhooks and Inngest functions alike. Cross-feature access goes only through another feature's `service.ts`. This is enforced by ESLint boundaries.

## Consequences

- ✅ One repo, one build, shared Zod/Prisma types, simple local development.
- ✅ Any module (AI engine, analytics) can later be extracted behind its service interface.
- ⚠️ Boundary discipline relies on lint rules and review. Violations must fail CI.

## Alternatives rejected

Microservices (ops overhead); SPA + separate API (duplicated types, two deploys).
