# 20 — Deployment Strategy

## 1. Environments

| Environment    | Purpose                                                  | URL                                               | Hosting                                                       | Database                                                                  | Third parties                                                                                                                                                                                                                                | Data                                 |
| -------------- | -------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Local**      | Development                                              | `http://localhost:3000`                           | `next dev` (Turbopack)                                        | Personal **Neon branch** (from `dev` parent) _or_ Docker Postgres 16      | Clerk dev instance; Stripe test (personal CLI forwarding); Cloudinary `nura/dev`; Resend test key (sandbox); Upstash dev DB; Inngest Dev Server; Anthropic dev key (low limits)                                                              | Seed                                 |
| **Preview**    | Per-PR review and E2E                                    | `nura-git-{branch}-{team}.vercel.app` (protected) | Vercel Preview                                                | Neon branch **per PR** (Vercel–Neon integration), migrated + seeded by CI | Clerk dev instance (shared); Stripe test (webhooks forwarded by the Stripe CLI during E2E runs; see §5.3); Cloudinary `nura/preview`; Resend test; Upstash preview DB; Inngest branch environments; Anthropic staging key                    | Seed                                 |
| **Staging**    | Pre-production, release candidate, nightly suites, demos | `staging.nuraskin.app`                            | Vercel (custom environment "staging", from the `main` branch) | Neon `staging` branch (persistent)                                        | Clerk **staging instance**; Stripe test account (staging); Cloudinary `nura/staging`; Resend staging domain; Upstash staging; Inngest staging env; Anthropic staging key                                                                     | Seed + synthetic history             |
| **Production** | Public portfolio deployment                              | `nuraskin.app` (fictional brand domain)           | Vercel Production (from `release` tags / promoted)            | Neon `main` (production project; PITR 7 days)                             | Clerk **production instance** (custom domain `clerk.nuraskin.app`); **Stripe test mode** (portfolio constraint; live-ready); Cloudinary `nura/prod`; Resend verified domain; Upstash prod; Inngest prod; Anthropic prod key with a spend cap | Curated demo data + real test orders |

**Branch model:** trunk-based. Short-lived feature branches → PR → `main`. `main` auto-deploys to **staging**. Production is released from a tag (`v1.x.y`) on a commit that is already green on staging.

**Correction (review R-02):** a Vercel deployment built for staging **cannot be promoted to production without a rebuild**, because `NEXT_PUBLIC_*` variables (Clerk/Stripe publishable keys, site URL) are inlined at build time and differ per environment. So "build once, promote the artifact" doesn't hold across environments. The pipeline instead guarantees **same commit + same lockfile + same build image**, and uses a **staged production deployment**: `vercel deploy --prod --skip-domain` builds with production env vars without taking traffic. Smoke tests run against that deployment URL. Then `vercel promote <url>` switches the domains without a rebuild, and Instant Rollback remains available.

---

## 2. Environment variables

All variables are validated at boot by `src/lib/env.ts` (Zod, via `@t3-oss/env-nextjs`). The build fails if any are missing or malformed. Client-exposed variables are prefixed `NEXT_PUBLIC_` and listed explicitly.

| Variable                                                                                       | Scope                       | Example / notes                                     | Envs                 |
| ---------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------- | -------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                                         | client                      | `https://nuraskin.app`                              | all (per env)        |
| `NEXT_PUBLIC_APP_ENV`                                                                          | client                      | `local\|preview\|staging\|production`               | all                  |
| `DATABASE_URL`                                                                                 | server                      | Neon **pooled** URL (`-pooler`, `sslmode=require`)  | all                  |
| `DIRECT_URL`                                                                                   | server (CI/migrations only) | Neon direct URL                                     | all                  |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                                                            | client                      | `pk_test_…` / `pk_live_…`                           | all                  |
| `CLERK_SECRET_KEY`                                                                             | server                      |                                                     | all                  |
| `CLERK_WEBHOOK_SIGNING_SECRET`                                                                 | server                      | Svix secret                                         | all                  |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `…_SIGN_UP_URL`                                              | client                      | `/sign-in`, `/sign-up`                              | all                  |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                                                           | client                      | `pk_test_…`                                         | all                  |
| `STRIPE_SECRET_KEY`                                                                            | server                      | **Restricted key** `rk_test_…`                      | all                  |
| `STRIPE_WEBHOOK_SECRET`                                                                        | server                      | `whsec_…` (per endpoint)                            | all                  |
| `STRIPE_SAVE_OFFER_COUPON_ID`                                                                  | server                      | Coupon for the 20% save offer                       | all                  |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`                                                            | client                      |                                                     | all                  |
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`                                                 | server                      | Signing                                             | all                  |
| `CLOUDINARY_FOLDER_PREFIX`                                                                     | server                      | `nura/prod`                                         | all                  |
| `ANTHROPIC_API_KEY`                                                                            | server                      |                                                     | all                  |
| `AI_MODEL`                                                                                     | server                      | `claude-opus-5`                                     | all                  |
| `AI_CLASSIFIER_MODEL`                                                                          | server                      | `claude-haiku-4-5`                                  | all                  |
| `AI_SELECTION_TIMEOUT_MS` / `AI_TOTAL_TIMEOUT_MS` / `AI_MAX_CONCURRENCY` / `AI_DAILY_CALL_CAP` | server                      | `10000` / `30000` / `20` / `400`                    | all                  |
| `RESEND_API_KEY`                                                                               | server                      |                                                     | all                  |
| `EMAIL_FROM`                                                                                   | server                      | `Nura Skin <hello@mail.nuraskin.app>`               | all                  |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`                                          | server                      |                                                     | all                  |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`                                                    | server                      |                                                     | preview/staging/prod |
| `COOKIE_SECRET` / `COOKIE_SECRET_PREVIOUS`                                                     | server                      | 32+ bytes; the previous one is kept during rotation | all                  |
| `TOKEN_SECRET`                                                                                 | server                      | Signed action tokens                                | all                  |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_AUTH_TOKEN` (build only)                     | server/client               |                                                     | preview/staging/prod |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`                                                  | client/server               | Contact, order lookup, finder abuse challenge       | all                  |
| `STORE_TIMEZONE`                                                                               | server                      | `America/New_York`                                  | all                  |
| `FEATURE_FLAGS_SECRET`                                                                         | server                      | Vercel Flags SDK                                    | staging/prod         |
| `LOG_LEVEL`                                                                                    | server                      | `info` (prod), `debug` (local)                      | all                  |

`.env.example` documents every variable with a description and no values. Secrets live in Vercel project settings (per environment) and GitHub Actions secrets (for migrations/E2E only). Local development pulls them with `vercel env pull .env.local`.

---

## 3. CI/CD pipeline

```
 PR opened/updated
   │
   ├─► GitHub Actions: ci.yml
   │     1. install (pnpm, cached)            2. typecheck (tsc --noEmit)
   │     3. lint + format check                4. gitleaks
   │     5. unit + component tests (Vitest)    6. create Neon branch (neonctl) → prisma migrate deploy → seed(min)
   │     7. integration tests                  8. next build (catches env/RSC boundary errors)
   │     9. AI eval (only if finder paths changed; label `run-ai-eval` to force)
   │
   ├─► Vercel: Preview deployment (build with preview env; Neon branch via integration)
   │     └─► post-deploy: migrate + seed the PR branch DB (GitHub Action on `deployment_status`)
   │
   └─► GitHub Actions: e2e.yml (on Vercel deployment_status=success)
         1. Playwright CUJ suite against the preview URL (Vercel protection bypass token)
         2. axe checks, visual snapshots
         3. Lighthouse CI (budgets)
         → results as PR checks + comment (links to the report artifacts)

 Merge to main (squash, Conventional Commit title)
   ├─► migrate.yml: prisma migrate deploy → **staging** DB (DIRECT_URL) — runs BEFORE the deploy is promoted
   ├─► Vercel: deploy main → staging environment
   ├─► smoke tests (Playwright @smoke tag) against staging
   └─► Sentry release created (source maps uploaded), associated commits

 Release (manual workflow "Release to production", or tag v*)
   1. Check that staging is green (smoke + nightly)
   2. Required reviewer approval (GitHub Environment "production")
   3. Build a **staged** production deployment: `vercel deploy --prod --skip-domain` (production env, no traffic)
   4. prisma migrate deploy → production DB (expand-only migrations; see §4)
   4b. Smoke tests against the staged deployment URL (reads production data; the checkout smoke creates and then expires a test session)
   4c. `vercel promote <staged-url>`, which switches domains without rebuilding the tested artifact
   5. Production smoke tests (@smoke: home, PDP, finder rule path, checkout session creation, admin login)
   6. Sentry release finalize; Slack/email notification
   7. Automatic rollback trigger: if the smoke fails → Vercel "Instant Rollback" to the previous deployment + alert
 Nightly (cron)
   full cross-browser E2E (staging), Stripe test-clock suite, AI eval, k6 smoke, dependency audit; weekly ZAP baseline
 Cleanup
   PR closed → delete the Neon branch, Inngest branch env auto-archives
```

**Pipeline principles:** same commit and lockfile per environment; production artifacts are smoke-tested before they receive traffic (staged deploy → promote); migrations run before the code that needs them; every step is idempotent and re-runnable; GitHub Actions pinned by SHA; concurrency groups cancel superseded runs per PR.

---

## 4. Database migration strategy

| Rule                   | Detail                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tooling                | `prisma migrate dev --create-only` locally → review/edit the SQL (add CHECKs, partial indexes, triggers) → commit. `prisma migrate deploy` in CI only. Never `db push` outside personal branches.                                                                                                                                        |
| Review                 | Migrations require CODEOWNERS approval; the PR template includes a "Migration safety" checklist                                                                                                                                                                                                                                          |
| **Expand → contract**  | Breaking changes are split across releases: (1) add nullable column/table (expand) → (2) deploy code that dual-writes and backfills (Inngest backfill job, batched 1,000 rows) → (3) switch reads → (4) add NOT NULL/constraint (`NOT VALID` + `VALIDATE CONSTRAINT` separately) → (5) drop the old column in a later release (contract) |
| Locking safety         | Indexes on large tables use `CREATE INDEX CONCURRENTLY` (a separate migration without a transaction wrapper); avoid table rewrites; `SET lock_timeout = '5s'` at the top of migrations                                                                                                                                                   |
| Backward compatibility | Each production migration must be compatible with the **currently running** code (because migrations run before the promotion)                                                                                                                                                                                                           |
| Rollback               | Code rollback is instant (Vercel). Schema rollback is rarely needed thanks to expand-only; if needed, a forward-fix migration is preferred. **Neon PITR / branch restore** for data incidents (restore to a branch, verify, then promote or copy data).                                                                                  |
| Pre-flight             | CI applies all migrations to a fresh branch **and** to a branch cloned from staging (catches data-dependent failures)                                                                                                                                                                                                                    |
| Seeds                  | Idempotent upserts; production gets catalogue/demo seeds only via an explicit manual workflow (`seed-prod-catalog`), never automatically                                                                                                                                                                                                 |
| Drift detection        | `prisma migrate diff` in CI between the schema and the migration history; the job fails on drift                                                                                                                                                                                                                                         |

---

## 5. Service configuration per environment

### 5.1 Vercel

- Framework preset Next.js; Node.js 22 runtime; **Fluid compute** enabled; function region `iad1` (co-located with Neon `us-east-1`).
- `maxDuration`: 60 s for `/api/v1/finder/**/recommend` (SSE) and the webhooks; default for the others.
- Deployment protection on previews (Vercel Authentication), with a bypass token for CI.
- Vercel Firewall: managed rules on; rate-limit rules as a second layer for `/api/v1/finder/*` and `/api/v1/cart/coupon`.
- Speed Insights + Web Analytics enabled (cookieless) in production.
- Cron: not used (Inngest owns scheduling). Vercel Cron is the fallback only if Inngest is unavailable.

### 5.2 Neon

- Project per production; `main` branch = production; `staging` = a long-lived branch; PR branches from `staging` (sanitized synthetic data).
- Autoscaling 0.25–2 CU (production min 0.5 to avoid cold starts); scale-to-zero only on preview branches.
- PITR retention 7 days (production); connection pooling (PgBouncer, transaction mode) for runtime.
- Extensions: `pg_trgm`, `citext`.

### 5.3 Stripe

- Separate test-mode accounts (or sandboxes) for staging and production to isolate data.
- Webhook endpoints: production `https://nuraskin.app/api/webhooks/stripe`; staging similarly; **previews (simplified in review R-18):** there is no registered endpoint and no custom router, since the router was an extra security-sensitive component to build and maintain. The E2E job runs `stripe listen --forward-to <previewUrl>/api/webhooks/stripe` (Stripe CLI authenticated with the CI restricted key. Its signing secret is stable for that key, `stripe listen --print-secret`, and is set once as the Preview-scope `STRIPE_WEBHOOK_SECRET`. The Vercel protection-bypass header is added via `--headers`) for the duration of the test run. Events from other concurrent runs are delivered too, but handlers ignore events whose `metadata.orderId` doesn't exist in that preview's Neon branch (logged as `ignored`). Manual preview testing of payments uses staging.
- Dashboard settings (captured in `docs/runbooks/stripe-setup.md`): Smart Retries, Customer Portal config (payment methods + invoices only), Radar rules, branding (colours/logo), Apple Pay domain verification per domain, Stripe Tax registration (P1).

### 5.4 Clerk

- Instances: development (local + preview), staging, production (custom domain, DNS records).
- Session token template with `metadata`; allowed origins; social connection credentials per instance; MFA enabled; bot protection on.

### 5.5 Others

Cloudinary: upload presets per environment (`nura_admin`, `nura_reviews`), named transformations created via a script (`scripts/cloudinary-setup.ts`). Resend: verified domain with SPF/DKIM/DMARC. Inngest: app per environment; the signing key is rotated yearly. Anthropic: separate keys per environment with workspace spend limits.

---

## 6. Monitoring

| Aspect                        | Tool                                                                           | Configuration                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Errors (client, server, edge) | **Sentry**                                                                     | Source maps; release tracking; environment tags; PII scrubbing; performance tracing 10% sample (100% for `/api/webhooks/*` and `/checkout/*` errors) |
| Uptime                        | Better Stack (or Checkly)                                                      | Checks every 1 min: `/`, `/api/health`, `/products/glow-serum`; multi-region; status page `status.nuraskin.app` (P2)                                 |
| Synthetic transactions        | Checkly/Playwright (every 30 min, production)                                  | Finder rule-path completion; checkout session creation (then expire it)                                                                              |
| Web vitals                    | Vercel Speed Insights                                                          | Per-route p75 LCP/INP/CLS; alert if p75 LCP > 2.5 s for 24 h                                                                                         |
| Business health               | Admin dashboard + daily digest email                                           | Orders, revenue, fallback rate, webhook failures, low stock                                                                                          |
| Jobs                          | Inngest dashboard                                                              | Failure alerts to email/Slack; replay                                                                                                                |
| Webhooks                      | `WebhookEvent` failed count; Stripe dashboard delivery status                  | Alert when failed > 0 for 15 min                                                                                                                     |
| AI                            | Finder insights (latency p95, fallback rate, tokens/day)                       | Alert when fallback > 10%/h or p95 > 10 s                                                                                                            |
| DB                            | Neon metrics (CPU, connections, storage) + `pg_stat_statements` review monthly | Alert on connections > 80%                                                                                                                           |
| Cost                          | Vercel spend management; Anthropic spend limit; Neon usage alerts              |                                                                                                                                                      |

**Alert routing:** P1 (checkout/webhooks down, 5xx > 5%, the site down) → immediate email + push; P2 (degraded: AI fallback spike, email failures) → email; P3 → daily digest.

---

## 7. Logging

| Aspect            | Decision                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library           | `pino` (JSON), with a thin `logger` wrapper providing `child({ requestId, userIdHash, route })`                                                                                               |
| Correlation       | `requestId` from `x-vercel-id` (or a generated UUID); propagated to Sentry scope, Inngest event data, Stripe metadata (`requestId` on session creation) and response headers (`x-request-id`) |
| Levels            | `error` (actionable), `warn` (degraded path, e.g. AI fallback), `info` (business events: order.paid, refund.created), `debug` (local only)                                                    |
| Redaction         | Paths: `*.email`, `*.name`, `*.address*`, `*.phone`, `*.notes`, `req.headers.cookie`, `req.headers.authorization`, `*.token`, `*.secret`                                                      |
| Destination       | Vercel runtime logs → **Log Drain** to Axiom/Better Stack Logs (30-day retention) for search and dashboards                                                                                   |
| Structured events | `log.info({ event: 'order.paid', orderId, totalCents, type })`: queryable business logs                                                                                                       |
| Audit vs logs     | Audit trails go to the `AuditLog` table (durable, 2 years); logs are operational and ephemeral                                                                                                |
| Sampling          | Info logs for hot public GETs sampled at 10%; errors always logged                                                                                                                            |

---

## 8. Release management

- **Versioning:** SemVer tags; the changelog is generated from Conventional Commits (`release-please`).
- **Feature flags:** risky features (a new prompt version, checkout changes) are shipped dark and enabled via flags/settings; kill switches `finder.enabled`, `checkout.enabled`, `reviews.enabled` and `newsletter.enabled` are in `StoreSetting` (effective within 60 s via cache tag revalidation).
- **Rollback:** Vercel Instant Rollback (seconds); data changes are handled via forward-fix; flags for behavioural rollback.
- **Maintenance window:** none needed (zero-downtime migrations); maintenance mode is available (15 ER13).

---

## 9. Runbooks (written in M9)

`docs/runbooks/`: `incident.md`, `key-rotation.md`, `stripe-setup.md`, `clerk-setup.md`, `webhook-replay.md` (reprocess failed `WebhookEvent`s), `db-restore.md` (Neon PITR branch restore), `ai-provider-outage.md` (force the fallback, communicate), `oversell.md` (handling `needsAttention` orders).
