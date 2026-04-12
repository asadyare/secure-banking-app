# Threat model, inherent risk, and risk analysis

**Application:** Baawisan Bank (demo) — React + Supabase (Auth, Postgres, RLS, RPC)  
**Document type:** Security architecture review (qualitative)  
**Related:** `pentest-report.md`, `pentest-phase2-staging-checklist.md`

---

## 1. Purpose and scope

| Deliverable | Purpose |
|-------------|---------|

| **Threat model** | Identify **who** can attack **what**, across **trust boundaries**, using a structured method (STRIDE). |
| **Inherent risk** | Risk **before** (or independent of) specific compensating controls — “raw” exposure if controls fail or are absent. |
| **Risk analysis** | Combine **likelihood** and **impact** into prioritized risk, and map to **treatment** (accept, mitigate, transfer, avoid). |

**Scope:** Application layer, Supabase project configuration, and client as deployed. **Out of scope:** Physical security, Supabase platform SLA incidents, end-user device malware (except where reflected in app design).

**Assumption:** Migrations are applied; RLS and `SECURITY DEFINER` functions match the repository.

---

## 2. System context (C4-level)

```Mermaid

[ End user browser ]  --HTTPS-->  [ Static SPA + bundled anon key ]
                                        |
                                        v HTTPS (REST / Auth / Realtime)
                                 [ Supabase project ]
                                        |
                    +-------------------+-------------------+
                    |                   |                   |
              [ GoTrue Auth ]      [ PostgREST ]        [ Postgres ]
              [ JWT issuance ]     [ RLS enforced ]     [ RLS + RPCs ]
```

**Primary assets:** User credentials (via Supabase Auth), session tokens (browser storage), account balances, transaction ledger, PII in `profiles`, admin privilege flag.

---

## 3. Trust boundaries

| Boundary | Inside | Outside / untrusted  |
|----------|--------|----------------------|

| B1 | Browser runtime after login | Malicious pages, XSS payloads, extensions |
| B2 | Supabase **with valid user JWT** | Anonymous callers without JWT (limited by policy) |
| B3 | **Service role** / SQL Editor | All app users and anon key |
| B4 | **SECURITY DEFINER** RPC body | Direct table writes from `authenticated` where revoked |

Crossing **B2** with a **forged or stolen JWT** is the main spoofing concern. Crossing **B4** incorrectly (weak RPC) is the main elevation / tampering concern.

---

## 4. Threat actors

| Actor | Motivation | Capability (typical)   |
|-------|------------|------------------------|

| **A1 — Anonymous internet** | Abuse APIs, enumerate, DoS | Scripts, Burp, stolen anon key from bundle |
| **A2 — Authenticated customer** | Steal funds, view others’ data, bypass limits | Browser devtools, crafted REST/RPC |
| **A3 — Malicious insider (operator)** | Abuse admin credit / customer lookup | Legitimate admin account, SQL if exposed |
| **A4 — Supply chain / dependency** | Inject code | Compromised npm package, build pipeline |

This app has **no separate “bank backend”** — the **database policies and RPCs** are the enforcement layer.

---

## 5. Threat model (STRIDE)

STRIDE maps threats to: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege.

| ID | Category | Threat | Affected asset / boundary | Mitigation in design (summary) |
|----|----------|--------|---------------------------|--------------------------------|

| T-S1 | Spoofing | Attacker uses stolen JWT or session | User session (B1→B2) | HTTPS; short-lived access token; sign-out; future: binding + MFA |
| T-S2 | Spoofing | Attacker calls API with another user’s UUID in body | Accounts/transfers (B2) | **Server checks `auth.uid()`** on source account in `transfer_funds` |
| T-T1 | Tampering | User edits `balance` via REST PATCH | Ledger integrity | **Column-level REVOKE** on `balance`; updates only via RPC |
| T-T2 | Tampering | User inserts fake `transactions` rows | Audit trail | **INSERT revoked** on `transactions` |
| T-T3 | Tampering | User modifies transfer amount in Burp | Financial correctness | **RPC validates** amount; server recomputes balances |
| T-R1 | Repudiation | User denies initiating transfer | Non-repudiation | **Immutable ledger** + reference IDs; idempotency records |
| T-I1 | Information disclosure | User lists another customer’s accounts | Confidentiality | **RLS** `user_id = auth.uid()` |
| T-I2 | Information disclosure | “Recipient not found” vs other errors | Privacy / enumeration | Generic errors; rate limits (recommended) |
| T-I3 | Information disclosure | Admin lists customers by email | PII | **RPC + `is_admin`** in SQL |
| T-D1 | Denial of service | Flood Auth or RPC endpoints | Availability | Supabase limits; **WAF/gateway** (recommended) |
| T-D2 | Denial of service | Spam `generate_account_number` / new accounts | Cost / noise | Account cap per user (recommended) |
| T-E1 | Elevation | Non-admin calls `admin_credit_account` | Privilege | **`is_admin` check** inside SECURITY DEFINER |
| T-E2 | Elevation | User sets `is_admin` on own profile | Privilege | **Column-level UPDATE** denies `is_admin` to clients |
| T-E3 | Elevation | XSS steals `localStorage` token | Session | CSP, sanitize HTML; React default escaping |

---

## 6. Inherent risk

**Definition (this document):** *Inherent risk* is the risk **assuming only the technology stack choices* (SPA + BaaS + Postgres) and **business purpose** (money movement), **before** counting project-specific mitigations you implemented (RLS hardening, RPC-only ledger, admin SQL checks).

| Area | Inherent risk (qualitative) | Rationale|
|------|-----------------------------|----------|

| **Client-side architecture** | **High** | Anon key and API surface are **public**; anyone can script against the same endpoints the UI uses. |
| **Financial transactions in DB** | **High** | If policies or RPCs are wrong **once**, impact is direct financial or data integrity loss. |
| **No dedicated application server** | **Medium–High** | No traditional WAF/app firewall in repo; rate limiting and abuse patterns must be **designed in** (Supabase + edge). |
| **Browser token storage** | **Medium** | Sessions in storage are **standard** for SPAs but create **XSS → session theft** coupling. |
| **Operator / admin functions** | **Medium** | Any “superuser” path (admin credit) is **high impact** if role assignment fails. |

**Inherent risk statement (one paragraph):**  
A browser-based banking UI backed **only** by a multi-tenant database with row-level security carries **high inherent risk** in confidentiality, integrity, and availability of funds and PII, because the **attack surface is the published API**, not a hidden internal network. That risk is **not eliminated** by React or TypeScript; it is reduced only by **correct database enforcement**, **operational monitoring**, and **edge controls**.

---

## 7. Risk analysis (with controls as implemented in repo)

Qualitative scale: **Impact** (1 negligible → 5 severe), **Likelihood** (1 rare → 5 frequent). **Risk score** = Impact × Likelihood (1–25).  
*Residual* = after migrations and intended configuration.

| Risk ID | Scenario | Impact | Likelihood | Score | Residual (post-design) | Treatment |
|---------|----------|--------|------------|-------|------------------------|-----------|

| R-01 | RLS misconfiguration exposes other users’ rows | 5 | 2 | 10 | **Low** if policies tested | Mitigate: CI policy tests, phase-2 REST checks |
| R-02 | Direct balance update via SQL/API | 5 | 1 | 5 | **Low** (column revoke + RPC) | Mitigate: keep REVOKE; audits |
| R-03 | Transfer from victim account (IDOR) | 5 | 2 | 10 | **Low** (owner check in RPC) | Mitigate: regression tests on `transfer_funds` |
| R-04 | Non-admin invokes admin RPC | 5 | 2 | 10 | **Low** (`is_admin` in SQL) | Mitigate: log admin RPC; separate admin app optional |
| R-05 | Account / recipient enumeration | 3 | 3 | 9 | **Medium** | Mitigate: generic errors, rate limits |
| R-06 | Credential stuffing / auth abuse | 4 | 4 | 16 | **Medium** | Mitigate: MFA, CAPTCHA, lockout, gateway limits |
| R-07 | DoS on Supabase endpoints | 3 | 3 | 9 | **Medium** | Mitigate: WAF, project alerts, Supabase plan limits |
| R-08 | XSS → token theft | 5 | 2 | 10 | **Medium–Low** | Mitigate: CSP, dependency audit, avoid raw HTML |
| R-09 | Frozen account bypass | 4 | 1 | 4 | **Low** (server check) | Mitigate: keep check in RPC; tests |

**Interpretation:** The **highest residual** areas for this codebase are **operational** (R-06, R-07) and **enumeration/abuse** (R-05), not missing ownership checks in the reviewed SQL.

---

## 8. Inherent vs residual (summary table)

| Dimension | Inherent (stack + domain) | Residual (with your controls) |
|-----------|---------------------------|-------------------------------|

| API exposure | Public anon key → **high** attack surface | RLS + RPC narrow **effective** surface |
| Money integrity | **High** if DB wrong | RPC-only writes + idempotency → **lower** |
| Admin abuse | **High** if role is client-only | DB-enforced `is_admin` → **lower** |
| Session theft | **Medium–high** (XSS) | Same; needs CSP + hygiene |

---

## 9. Recommended next steps

1. **Treat inherent risk** as a standing requirement for **any** change to RLS, GRANTs, or RPC signatures (code review + SQL diff).  
2. **Quantify residual risk** after staging dynamic tests using `pentest-phase2-staging-checklist.md`.  
3. **Track** risk register items (R-01 … R-09) in ticketing with owners and review dates.

---

## 10. References

- STRIDE: Microsoft threat modeling classic (spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege).  
- NIST SP 800-30 (risk assessment — qualitative scales).  
- OWASP Threat Modeling: [![https://owasp.org/www-community/Threat_Modeling]]  

---

*End of document.*
