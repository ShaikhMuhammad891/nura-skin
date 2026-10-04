# Nura Skin: Specification Index

The foundation documents for the Nura Skin build. **The spec is the source of truth.** When implementation diverges, update the doc or add an ADR in `docs/adr/`.

| #   | Document                                                   | Covers                                                                                                                 |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 01  | [Product requirements](01-product-requirements.md)         | Vision, audience, positioning, features (P0–P2), goals, metrics, release criteria                                      |
| 02  | [Business model](02-business-model.md)                     | Catalogue & pricing, subscriptions, retention, upsell, marketing, lifecycle                                            |
| 03  | [User personas](03-user-personas.md)                       | 3 customers + Admin, Inventory, Marketing, Support; traceability matrix                                                |
| 04  | [User flows](04-user-flows.md)                             | 10 customer flows + 5 admin flows with edge cases and events                                                           |
| 05  | [Software requirements](05-software-requirements.md)       | Functional + non-functional (perf, a11y, SEO, security, scale)                                                         |
| 06  | [System architecture](06-system-architecture.md)           | Architecture, **technology stack & rationale**, caching, jobs, email, images, ADRs                                     |
| 07  | [Folder structure](07-folder-structure.md)                 | Repo & `src/` layout, naming, import boundaries                                                                        |
| 08  | [Database design](08-database-design.md)                   | Every table (fields, types, relations, indexes, constraints), state machines, Prisma plan                              |
| 09  | [API design](09-api-design.md)                             | Conventions, DTOs, every endpoint (public, customer, AI, admin, webhooks)                                              |
| 10  | [Authentication design](10-authentication-design.md)       | Clerk, guest identity, middleware, RBAC permission matrix                                                              |
| 11  | [Payment design](11-payment-design.md)                     | Stripe mapping, checkout, pricing engine, webhooks, subscriptions, refunds                                             |
| 12  | [AI Routine Finder design](12-ai-routine-finder-design.md) | Questionnaire, pipeline, scoring, prompt, validation, fallback, safety, evals                                          |
| 13  | [Design system](13-design-system.md)                       | Tokens, type, components, motion, mobile, dark mode                                                                    |
| 14  | [Brand guidelines](14-brand-guidelines.md)                 | Personality, voice, logo, packaging, photography, illustration, social                                                 |
| 15  | [Page inventory](15-page-inventory.md)                     | All routes + loading / empty / error states                                                                            |
| 16  | [Component inventory](16-component-inventory.md)           | Every component and its responsibility                                                                                 |
| 17  | [Asset inventory](17-asset-inventory.md)                   | ~210 assets with sizes, usage and AI generation prompts                                                                |
| 18  | [Security plan](18-security-plan.md)                       | Threat model, controls, OWASP (web + LLM), launch checklist                                                            |
| 19  | [Testing strategy](19-testing-strategy.md)                 | Unit, integration, E2E CUJs, a11y, perf, AI evals, manual checklist                                                    |
| 20  | [Deployment strategy](20-deployment-strategy.md)           | Environments, env vars, CI/CD, migrations, monitoring, logging                                                         |
| 21  | [Development roadmap](21-development-roadmap.md)           | M0–M10 milestones with files, dependencies, tests, completion criteria                                                 |
| 22  | [Portfolio case study](22-portfolio-case-study.md)         | Problem, solution, challenges, decisions, results template                                                             |
| 23  | [Architecture review](23-architecture-review.md)           | Pre-implementation review: 38 findings, resolutions applied to docs 01–22, open verification items, go/no-go checklist |

> **Revision note:** the docs were revised after the pre-implementation review (doc 23). Sections changed by the review carry an `R-xx` reference so each decision can be traced.

## Notes on the document map

- The brief's "Technology Stack" section is covered in **06 §2**, because the requested file list has no separate stack document.
- **10 (Authentication)** and **11 (Payments)** were in the requested file list without their own requirement sections. They were derived from the architecture, security and business requirements.

---

## 1. Documentation completion checklist

- [x] 01 Product vision, mission, audience, positioning, problems, features, goals, metrics, future ideas
- [x] 02 Revenue model, product sales, subscriptions, retention, upsell, marketing, lifecycle
- [x] 03 Personas: Customer (×3), Admin, Inventory Manager, Marketing Manager (+ Support)
- [x] 04 Customer flows (first visit → review) and admin flows (login → analytics)
- [x] 05 Functional, non-functional, performance, accessibility, SEO, security, scalability requirements
- [x] 06 Frontend, backend, DB, external services, auth flow, payment flow, AI, images, email, caching, jobs + stack rationale
- [x] 07 Folder structure
- [x] 08 All 20 requested entity groups plus supporting tables, with fields/types/relations/indexes/constraints + Prisma planning
- [x] 09 Endpoints for products, auth/account, cart, wishlist, orders, payments, subscriptions, AI, admin, analytics
- [x] 10 Authentication & authorization design
- [x] 11 Payment & subscription design
- [x] 12 Questionnaire, data, logic, DB integration, prompt strategy, matching, fallback, safety, "why not random products"
- [x] 13 Colours, type, spacing, radius, shadows, buttons, inputs, cards, nav, motion, forms, tables, modals, mobile, dark mode
- [x] 14 Personality, voice, logo, packaging, photography, illustration, marketing, social
- [x] 15 Public, customer, admin, auth, error pages + loading and empty states
- [x] 16 Component inventory with responsibilities
- [x] 17 Assets with name, purpose, dimensions, style, usage and AI prompt (no-placeholder enforcement)
- [x] 18 Auth security, authorization, validation, API, payments, data protection, rate limiting, attack prevention
- [x] 19 Unit, integration, E2E, manual checklist, critical journeys
- [x] 20 Environments, env vars, CI/CD, migrations, monitoring, logging
- [x] 21 Milestones with goal, features, files, dependencies, tests, completion criteria
- [x] 22 Case study

## 2. Recommended implementation order

M0 Foundations → M1 Data layer & seed → **M1.5 Stripe spike** → M2 Auth & RBAC → M3 Catalogue storefront → **M3.5 AI spike + eval harness** → M4 Cart & pricing → M5 Checkout, payments, orders → M6 AI Routine Finder → M7 Subscriptions, account, reviews → M8 Admin → M9 Hardening → M10 Portfolio packaging. Details in 21.

## 3. Biggest technical risks

Each is tracked as an ADR candidate:

1. LLM latency/quality/cost in the conversion path (mitigation: M3.5 spike, low effort, caching, fallback, evals).
2. Stripe mixed-cart + stacked-discount modelling and webhook ordering (mitigation: M1.5 spike, idempotent convergent handlers, reconciliation).
3. Inventory correctness under serverless concurrency (row locks, reservations, concurrency tests).
4. Catalogue knowledge-base quality (the engine is only as good as its efficacy, conflict and safety data).
5. Asset production volume and consistency (~210 assets; label compositing).
6. Scope and timeline for a single developer (strict P0/P1 discipline).
7. Next.js caching and PPR semantics evolving between versions (pin versions; isolate cache helpers).

## 4. Recommended improvements before coding begins

1. **Have a domain expert review the ingredient data.** Efficacy scores, conflict pairs, pregnancy flags and concentration thresholds drive every recommendation. Get them reviewed by a cosmetic chemist or dermatology-literate reviewer, even informally.
2. **Run the two spikes (M1.5 Stripe, M3.5 AI) before the full build.** Record the results as ADRs and adjust docs 11 and 12.
3. **Pin versions.** Confirm the exact current Next.js, Prisma, Clerk, Tailwind and Anthropic SDK versions and their APIs (for example `middleware` vs `proxy`, Cache Components flags, Prisma driver-adapter status). Pin them in `package.json`.
4. **Write the AI eval golden set first.** Write 30 cases before any prompt, so that "good" is defined before it is built.
5. **Provision all accounts early.** Clerk (dev/staging/prod), Stripe test accounts, Neon, Cloudinary, Resend domain DNS, Upstash, Inngest, Sentry and Anthropic keys with spend limits.
6. **Create the brand foundations in design tools.** Build the vector logo, the label templates for compositing and a Figma token file mirroring `tokens.json`, then generate a first batch of 10 hero and product assets to lock the look.
7. **Decide the public demo policy.** Choose what anonymous reviewers can do in the admin (read-only demo roles, simulated refunds, a nightly reset) before building the admin.
8. **Get a legal-copy baseline.** Privacy policy covering health-adjacent data and the LLM provider, subscription auto-renewal terms, and cosmetic-claims wording.
