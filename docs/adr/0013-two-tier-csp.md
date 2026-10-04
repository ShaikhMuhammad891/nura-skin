# ADR-0013: Two-tier Content Security Policy

- **Status:** Accepted · **Date:** 2026-09-28 · **Refs:** 18 §6; review R-03

## Context

A nonce-based CSP needs a unique nonce per response, which forces dynamic rendering and disables SSG/ISR/PPR shells. Those are central to the performance targets.

## Decision

- **Strict tier** (nonce + `'strict-dynamic'`): `/checkout/**`, `/account/**`, `/admin/**`, `/finder/results/**`, `/sign-in`, `/sign-up`, `/auth/**`, `/orders/view`. These routes are already dynamic and handle payments, PII or admin power.
- **Static tier** (no nonce): catalogue, content and finder steps. The policy is `script-src 'self' 'unsafe-inline'` + explicit hosts (no `unsafe-eval`), with strict `object-src`, `base-uri`, `form-action`, `frame-ancestors`, `connect-src` and `img-src`.
- The headers are set per route group in middleware/proxy.
- Upgrade path: hash/SRI-based CSP for static pages once Next.js support is stable.

## Consequences

- ✅ Performance strategy preserved; the strongest protection sits where the risk is.
- ⚠️ Static pages accept inline scripts. This is mitigated by having no user-authored HTML (React-escaped reviews, sanitized staff Markdown).

## Implementation note (M0)

`upgrade-insecure-requests` is emitted **only when `NEXT_PUBLIC_SITE_URL` is https**. On a plain-HTTP origin (local production testing, CI), WebKit, unlike Chromium, does not exempt localhost. It rewrites every subresource to `https://`, so the whole page renders without CSS. The M0 E2E suite caught this on the iPhone/WebKit profile. It is guarded by the "stylesheets load and design tokens apply" smoke test. HTTPS enforcement in production comes from HSTS regardless.
