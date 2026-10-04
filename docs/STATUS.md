# Project status

**Last updated:** 2026-10-04 · **Live:** https://nura-skin-1fzq.vercel.app · **Repo:** github.com/ShaikhMuhammad891/nura-skin

The single place to see what's built, what's live, and what's next. Update it at the end of
every working session. The plan lives in [`21-development-roadmap.md`](21-development-roadmap.md);
the "why" behind decisions lives in [`adr/`](adr/README.md).

---

## 1. Milestones

| Milestone                          | Status         | Notes                                                                                                                                                                                                                                                 |
| ---------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Foundations                     | ✅ Done        | Tooling, design tokens, CI, security headers                                                                                                                                                                                                          |
| M1 Data layer & seed               | ✅ Done        | Prisma 7.10 schema, 2 migrations, seeded catalogue (14 products, 5 routines)                                                                                                                                                                          |
| M2 Auth & RBAC                     | ✅ Done        | Clerk, proxy gates, permissions, admin shell, step-up re-verification, demo staff sign-in (off unless `DEMO_MODE_ENABLED`)                                                                                                                            |
| M3 Storefront & SEO                | ✅ Done        | Shop/category/PDP/routines/ingredients/concerns/search (⌘K), science/about/FAQ/legal, sitemap, robots, JSON-LD, real 404/410/308 via the proxy catalogue gate ([ADR-0020](adr/0020-storefront-rendering-and-catalogue.md))                            |
| M4 Cart, pricing, wishlist         | 🟡 Partial     | Pricing engine, cart service and actions done. **Missing:** cart drawer + header count, quantity controls, coupon box UI, free-shipping bar, wishlist                                                                                                 |
| M5 Checkout, payments, orders      | 🟡 Partial     | Stripe embedded checkout, webhooks, reservations, order lifecycle **verified live** (order NURA-100001 paid). **Missing:** order confirmation page, guest order lookup, emails                                                                        |
| M6 Routine Finder                  | 🟡 Core done   | Questionnaire, rules-engine results (3 tiers), add routine to cart, saved routines, guest claim ([ADR-0021](adr/0021-finder-rules-engine-first.md)). **Missing:** swap a step, shade choice, email routine, Claude explanations (needs Anthropic key) |
| M7 Subscriptions, account, reviews | ⬜ Not started | Account page shows saved routines only                                                                                                                                                                                                                |
| M8 Admin dashboard                 | ⬜ Not started | Shell + permission-filtered nav exist; pages (orders, products, inventory, coupons, KPIs) not built                                                                                                                                                   |
| M9 Hardening                       | ⬜ Not started | Needs free accounts: Sentry, Upstash, Resend, Inngest, Cloudinary, Turnstile                                                                                                                                                                          |
| M10 Portfolio packaging            | ⬜ Not started |                                                                                                                                                                                                                                                       |

**Next up (in order):** M4/M5 cart & checkout polish → M7 account + orders → M8 admin → M7 subscriptions → M9 hardening.

---

## 2. Live environment

| Service | State                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------- |
| GitHub  | Public repo; CI: secret scan, format/lint/typecheck/unit/build, integration, E2E (all green)            |
| Vercel  | Hobby, project `nura-skin-1fzq`, functions in `cle1` (`vercel.json`), Node 22, pnpm via corepack        |
| Neon    | Postgres, region **AWS us-east-2 (Ohio)**, migrated + seeded                                            |
| Clerk   | **Development** instance (no custom domain yet). Webhook → `/api/webhooks/clerk`                        |
| Stripe  | Sandbox / test mode. Event destination → `/api/webhooks/stripe`                                         |
| Not yet | Anthropic, custom domain (both paid, deferred), Sentry, Upstash, Resend, Inngest, Cloudinary, Turnstile |

**Vercel env vars:** `DATABASE_URL`, `DIRECT_URL` (Neon, `sslmode=verify-full`), `COOKIE_SECRET`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_ENV=production`, `ENABLE_EXPERIMENTAL_COREPACK=1`.
**GitHub secrets (E2E):** `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (Clerk dev instance).

**Admin:** the owner's account is ADMIN (`npm run user:role -- <email> ADMIN`). `/admin` also
requires Clerk two-step verification (enable MFA in the Clerk dashboard, then enrol).

---

## 3. Working on it

```bash
npx -y pnpm@12.6.0 install       # pnpm 12 isn't on PATH; corepack can't launch it on Node 22
npm run db:local                 # embedded Postgres on :5433 (keep running in its own terminal)
npm run dev                      # http://localhost:3000
```

- `.env.local` currently points at **Neon**: everything works but local pages are slow (far
  away). For fast local work point `DATABASE_URL`/`DIRECT_URL` at `postgresql://nura:nura@localhost:5433/nura_dev`.
- Schema changes: `prisma migrate dev --create-only` → edit SQL → `npm run db:deploy`. Never the
  interactive `prisma migrate dev`.
- Before pushing anything that touches routing, caching, env or CI, run the CI pipeline locally:
  `npm run tokens && npm run format:check && npm run lint && npm run typecheck && npm test &&
npm run test:int`, plus a production build with no database (CI builds without one).

**Tests (2026-10-04):** 286 unit · 107 integration · 31 E2E (Chromium + mobile Safari, prod build).

---

## 4. Known issues & decisions to revisit

- Private dynamic pages (`/finder/[id]`, results) return a streamed 200 with the not-found UI for
  strangers (noindex), not a hard 404. Catalogue pages get real statuses from the proxy gate.
- Rate limiting is per-instance memory until Upstash exists.
- Demo staff sessions aren't capped at 1 h yet; signed-in role E2E tests (customer → 404, staff
  without MFA → redirect) need Clerk test users.
- `messages/en.json` (centralised copy) and Lighthouse budgets are not in place.
- Product images are illustrated SVG packshots until Cloudinary assets exist.

---

## 5. Session log

| Date       | Work                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-28 | M0, M1, domain core, inventory/cart/order services, finder engine                                                                                             |
| 2026-09-29 | M2 Clerk core, M5 Stripe checkout + webhooks                                                                                                                  |
| 2026-10-04 | M2 finish, M3 storefront, GitHub + CI green, Neon, Vercel deploy, live payment verified, proxy status gate, M6 finder (rules engine), owner promoted to ADMIN |
