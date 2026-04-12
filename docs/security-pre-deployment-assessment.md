# Security assessment — pre-deployment

**Scope:** Application and database controls in this repo, Docker/nginx static serving, Terraform/CloudFront patterns referenced in-repo.  
**Date context:** Assessment reflects the repository state at authoring time; re-run checks before each production release.

---

## Automated checks (what we ran)

| Check | Result | Notes |
|--------|--------|--------|
| **Vitest** (`npm test`) | Pass | Only `src/test/example.test.ts` — coverage of business/security paths is minimal. |
| **ESLint** (`npm run lint`) | Pass (warnings only) | 8× `react-refresh/only-export-components` in UI/hooks — not security blockers. |
| **npm audit** (high+) | **Findings** | 4 high / 3 moderate (transitive: `flatted`, `lodash`, `picomatch`, `undici`, etc.). Run `npm audit fix` and re-test; some fixes may require major version bumps. |

**CI:** Your GitHub workflow already runs lint, tests, CodeQL, Trivy, Semgrep, Gitleaks, etc. — keep that green before deploy.

---

## What is already in good shape

### Backend (Supabase)

- **Row Level Security** and **SECURITY DEFINER** RPCs are used; migrations include explicit **security hardening** (e.g. `20260328120000_security_hardening.sql`): transfer idempotency, restricted inserts, `transfer_funds` with ownership checks and amount caps.
- **Admin operations** (`admin_list_customer_accounts`, `admin_credit_account`) enforce **`is_admin` inside the database**, not only in the UI — non-admins get `Not authorized` even if they call the API directly (`20260328220000_admin_credit_customers.sql`).
- **Profiles:** clients cannot self-promote to admin (column-level grants).

### Frontend

- **Route gating:** `ProtectedRoute` / `PublicRoute` prevent casual navigation without a session.
- **Admin UI:** `/admin/credit` hides actions for non-admins; **server still enforces** (above).
- **Input validation:** Zod schemas on auth and transfers (`transferFormSchema`, `transferToSomeoneSchema`, etc.).
- **Transfer:** Uses **idempotency keys** and `transfer_funds` RPC (no raw ledger writes from the client).

### Docker / static server

- **nginx** (`docker/nginx/default.conf`): `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` — aligns with dev headers in `vite.config.ts`.

### Infrastructure (Terraform module)

- S3 **not public**; **OAC** to CloudFront; **HTTPS** redirect on viewer; optional **WAF** with managed rule groups when `enable_waf` is set.

---

## Gaps and recommended hardening (priority order)

### P0 — Do before or as part of first production cutover

1. **Resolve or accept `npm audit` issues**  
   Address high-severity transitive deps where possible (`npm audit fix`, then full regression). For residual issues, document risk acceptance (often dev/test-only paths).

2. **Secrets and env**  
   - Never commit `.env`; rotate any key that appeared in history or examples.  
   - **Production build:** use **HTTPS** Supabase URL only; the client allows `http:` for local dev (`client.ts`) — acceptable locally, not for prod CI secrets.

3. **Supabase dashboard**  
   - Confirm **Auth redirect URLs** and **site URL** match your real CloudFront/custom domain.  
   - Re-verify **RLS** policies in Supabase for all tables exposed to `authenticated`.

### P1 — Strongly recommended soon after go-live

4. **HTTP security headers on CloudFront (static deploy)**  
   **Implemented in Terraform** (`modules/aws_static_site`): a **CloudFront response headers policy** attaches to the default cache behavior with the same baseline as `docker/nginx/default.conf` plus **HSTS** and **Permissions-Policy**. Adjust `hsts_include_subdomains` / `hsts_preload` in `terraform.tfvars` when you use a custom domain and meet preload requirements.

5. **Content-Security-Policy (CSP)**  
   Not set today. A **tight CSP** (default-src, script-src for your bundle + Supabase) reduces XSS impact. Requires testing (Supabase and any CDNs must be allowlisted). Start with report-only mode if needed.

6. **Session storage**  
   Supabase session in **localStorage** is standard but **XSS** becomes critical. CSP + strict dependency hygiene + no `dangerouslySetInnerHTML` with untrusted data reduce risk.

### P2 — Quality and resilience

7. **Tests**  
   Add integration/E2E tests for **auth**, **transfer**, and **admin denial** for non-admin users (Playwright is already present in `tests/e2e`).

8. **Rate limiting**  
   Auth and sensitive RPCs: rely on **Supabase / platform** limits; consider **WAF rate rules** or API abuse monitoring for the public URL.

9. **Geo / compliance**  
   Terraform `geo_restriction` is currently **none**; tighten if your policy requires.

---

## Do you “need” more hardening before deploy?

**You already have meaningful controls** (RLS, server-side RPCs, admin checks in DB, idempotent transfers, route guards, CI security jobs).  

**Yes, complete the P0 items** (dependency audit posture, secrets hygiene, prod URLs) **before** calling production “ready.”  

**P1 (headers, HSTS, CSP)** is the main **gap vs. a hardened public SPA** — especially for **CloudFront**, where headers are not automatically the same as your Docker nginx config.

---

## Quick re-checklist before deploy

- [ ] `npm audit` addressed or exceptions documented  
- [ ] `npm test` + `npm run lint` + CI security green  
- [ ] Production Supabase URL + anon key only in CI secrets; HTTPS URL  
- [ ] Supabase Auth redirect URLs + RLS reviewed  
- [ ] CloudFront (or LB) **response headers** + **HSTS** planned  
- [ ] CSP planned (even phased)  
- [ ] No real credentials in repo or example files  

---

*This document is an engineering assessment, not legal or compliance sign-off. For regulated banking, involve your security and compliance teams.*
