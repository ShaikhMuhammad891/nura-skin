# Architecture Decision Records

Format: [MADR-lite](https://adr.github.io/madr/). One decision per file, immutable once **Accepted**. Supersede an ADR with a new one instead of editing it.

| ADR                                                       | Title                                                                | Status                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| [0001](0001-modular-monolith.md)                          | Modular monolith on Next.js App Router                               | Accepted                                 |
| [0002](0002-stripe-embedded-checkout.md)                  | Stripe Embedded Checkout                                             | Accepted                                 |
| [0003](0003-webhooks-source-of-truth.md)                  | Webhooks are the source of truth for payment state                   | Accepted                                 |
| [0004](0004-inventory-reservations.md)                    | Inventory reservations + movement ledger                             | Accepted                                 |
| [0005](0005-grounded-llm.md)                              | Grounded LLM: candidates, static index schema, validator, fallback   | Accepted                                 |
| [0006](0006-roles-db-mirrored-to-clerk.md)                | Roles in DB, mirrored to Clerk                                       | Accepted                                 |
| [0007](0007-transactional-outbox.md)                      | Transactional outbox → Inngest                                       | Accepted                                 |
| [0008](0008-money-integer-cents.md)                       | Money as integer cents, discounts in basis points                    | Accepted                                 |
| [0009](0009-first-party-analytics.md)                     | First-party analytics events + typed daily rollups                   | Accepted                                 |
| [0010](0010-asset-manifest.md)                            | Cloudinary publicIds + CI-checked asset manifest                     | Accepted                                 |
| [0011](0011-stripe-api-version-and-checkout-findings.md)  | Stripe API version pin and checkout findings                         | Accepted (payment mode)                  |
| [0012](0012-ai-two-phase-output.md)                       | AI model, effort, two-phase streamed output                          | Accepted in design; numbers pending M3.5 |
| [0013](0013-two-tier-csp.md)                              | Two-tier CSP                                                         | Accepted                                 |
| [0014](0014-staged-production-deploys.md)                 | Staged production deploys                                            | Accepted                                 |
| [0015](0015-auth-complete-and-no-external-calls-in-tx.md) | `/auth/complete` claim handler; no external calls in DB transactions | Accepted                                 |
| [0016](0016-demo-staff-role.md)                           | `DEMO_STAFF` role with rolled-back mutations                         | Accepted                                 |
| [0017](0017-server-actions-first.md)                      | Server Actions first; REST only where HTTP semantics are needed      | Accepted                                 |
| [0018](0018-toolchain-versions.md)                        | Toolchain & framework versions                                       | Proposed (pending first install)         |
| [0019](0019-local-postgres-and-pg-adapter.md)             | Embedded Postgres for dev/test; node-postgres adapter at runtime     | Accepted                                 |
| [0020](0020-storefront-rendering-and-catalogue.md)        | Storefront rendering, real status codes, in-memory catalogue         | Accepted                                 |
