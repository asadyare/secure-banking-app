# 01 — Project overview

## What this is

**Baawisan Bank** is a front-end banking application (Vite + React + TypeScript + Tailwind + shadcn/ui) backed by Supabase for authentication and data. The production build is a static SPA served from **Amazon CloudFront** in front of a private **S3 bucket**, provisioned and managed by **Terraform** and released through a hardened **GitHub Actions** pipeline that assumes AWS via **OIDC** (no long-lived keys).

The case study that follows is not just a description of what was built; it documents the **DevSecOps journey** — every blocking CI/security/IaC/deploy issue encountered, the root cause, the fix, and the proof (PR, run, diff, log excerpt) that the fix held.

## Goals

The product goals are mundane (user-facing static SPA wired to a BaaS). The engineering goals are the interesting part:

1. **Supply-chain hardened CI** — every third-party GitHub Action pinned to a commit SHA (not a floating tag), every package-manager invocation scoped and reproducible.
2. **Multiple overlapping security scanners**, each with a written rationale for any finding it ignores:
   - SAST: [Semgrep](../../.github/workflows/ci.yml), GitHub [CodeQL](#) (default setup).
   - Dependencies / vulns: [Trivy](../../.github/workflows/ci.yml) (filesystem + SARIF), Dependabot, npm audit in CI.
   - Secrets: [TruffleHog](../../.github/workflows/secret-scan.yml) (only-verified), local [gitleaks](../../.husky/pre-commit) pre-commit + pre-push, CI gitleaks job.
   - IaC: [Checkov](../../checkov.yaml), Trivy IaC, Terraform fmt + validate.
   - DAST: OWASP [ZAP baseline](../../.zap/rules.tsv).
   - SBOM: CycloneDX via `@cyclonedx/cdxgen` on every CI run.
3. **Least-privilege AWS access** — no static IAM users in CI, OIDC-trusted role with an inline policy scoped to exact bucket + distribution ARNs.
4. **Defense-in-depth at the edge** — CloudFront in front of a private S3 origin (no public objects), WAFv2 WebACL attached, response-headers policy emitting HSTS / CSP / COOP / COEP / CORP / Permissions-Policy / Referrer-Policy / X-Content-Type-Options / X-Frame-Options.
5. **Preflight safety** — every AWS-touching job verifies its prerequisites (secrets set, bucket reachable, distribution reachable) before it tries to mutate anything, failing fast with an actionable summary rather than a mid-operation `NoSuchBucket`.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + React + TypeScript + Tailwind + shadcn/ui | Fast build, type safety, accessible component primitives |
| Auth + data | Supabase (Auth + Postgres) | Managed BaaS; lets us focus the security story on the edge, IaC, and pipeline |
| Testing | Vitest + Playwright | Unit + E2E both wired into CI |
| CDN / edge | Amazon CloudFront + WAFv2 + response-headers policy | Global distribution, managed TLS, WAF AWS-managed rule groups |
| Object store | Amazon S3 (private, OAC-fronted) | No public ACLs, access only via CloudFront Origin Access Control |
| IaC | Terraform (S3 remote state + DynamoDB lock) | Declarative, review-gated via Checkov + Trivy IaC + Terraform fmt/validate in CI |
| CI/CD | GitHub Actions (OIDC → AWS) | No static keys, SHA-pinned actions, branch-protected `main` |
| Hooks | Husky (pre-commit + pre-push) | Local gitleaks + ESLint before the PR even exists |

## Threat model pointers

Rather than duplicate work, the case study links into the existing security documentation in this repo:

- [docs/threat-model-risk-analysis.md](../threat-model-risk-analysis.md) — STRIDE-style threat model and risk register.
- [docs/security-pre-deployment-assessment.md](../security-pre-deployment-assessment.md) — pre-deploy security sign-off checklist.
- [docs/pentest-report.md](../pentest-report.md) and [docs/pentest-phase2-staging-checklist.md](../pentest-phase2-staging-checklist.md) — manual pentest findings and staging checklist.
- [docs/github-oidc-aws.md](../github-oidc-aws.md) — OIDC trust-policy bootstrap walkthrough.
- [docs/deploy-aws.md](../deploy-aws.md) — go-live playbook (Terraform apply → secrets → deploy).
- [docs/deployment-comparison.md](../deployment-comparison.md) — static S3+CloudFront vs containerised trade-off write-up.

## How to read this case study

1. [**02 — Architecture**](02-architecture.md): three mermaid diagrams (runtime request path, CI/CD pipeline, OIDC trust model).
2. [**03 — Security controls**](03-security-controls.md): per-scanner breakdown — what it checks, why we chose it, where it is wired, how we treat its findings.
3. [**04 — CI/CD pipeline**](04-cicd-pipeline.md): the workflows themselves — triggers, permissions, gating, preflight checks, Dependabot behaviour.
4. [**05 — Incident log**](05-incident-log.md): a one-page chronological index of every issue fixed, with links into the deep-dives.
5. [**06 — Incidents**](06-incidents/): one file per incident — symptom (with failing-run link), root cause, fix (with PR diff + permalink), proof (passing run), and lessons.
6. [**shot-list.md**](shot-list.md): the screenshots you still need to capture (live site, AWS Console views, Security tab) so the portfolio showcase is visually complete.
