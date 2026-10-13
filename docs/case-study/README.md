# Case study — Baawisan Bank secure deployment

This folder is the **portfolio-ready deep dive** for the [secure-banking-app](https://github.com/asadyare/secure-banking-app) project. It documents the app, the security posture, the CI/CD pipeline, and — most importantly — **every blocking issue hit on the way to the first live deploy**, with the PR/commit/run/log evidence to prove each fix.

If you are evaluating this as a portfolio piece, start with the [TL;DR](#tldr) and the [incident log](05-incident-log.md); if you want to go deep, read top to bottom.

## TL;DR

- **What it is:** a React + Vite + Supabase banking SPA, served via Amazon CloudFront in front of a private S3 origin, provisioned by Terraform and deployed by GitHub Actions using OIDC (no long-lived AWS keys).
- **Why it is interesting:** six overlapping scanners (Semgrep, CodeQL, Trivy, Checkov, ZAP, TruffleHog + Gitleaks + Dependabot) run on every push; the `main` branch has a ruleset requiring **all of them green** before merge; the deploy workflow assumes a least-privilege IAM role scoped to exact bucket + distribution ARNs.
- **What is documented here:** 19 blocking incidents — symptom, root cause, fix (with PR diff + permalink), proof (with passing-run link), screenshot slot. Every scanner false-positive has a written rationale; every suppression has a matching `IGNORE` / `nosemgrep` / `skip-check` entry traceable back to this folder.
- **First successful deploy:** workflow run [`24605611658`](https://github.com/asadyare/secure-banking-app/actions/runs/24605611658).

## Contents

| File | What is inside |
|---|---|
| [01-overview.md](01-overview.md) | Project goals, stack, pointers to the existing threat model + pentest docs |
| [02-architecture.md](02-architecture.md) | Three mermaid diagrams: runtime request path, CI/CD pipeline, OIDC trust model |
| [03-security-controls.md](03-security-controls.md) | Per-scanner breakdown — what it checks, where it is wired, how suppressions are justified |
| [04-cicd-pipeline.md](04-cicd-pipeline.md) | The four workflows, permission model, preflight pattern, OIDC flow, Dependabot policy |
| [05-incident-log.md](05-incident-log.md) | Single-page chronological index of every blocking issue fixed |
| [06-incidents/](06-incidents/) | One file per incident — symptom, root cause, fix diff + PR link, proof, lessons |
| [shot-list.md](shot-list.md) | Numbered screenshot plan for the portfolio showcase (live site, AWS Console, Security tab, ZAP report) |
| `assets/` | Screenshot destination folder — `TODO-*.png` placeholders mark shots still needed |

## The 19 incidents (headlines only)

For the full narrative — symptom, root cause, fix, proof, lessons — see [05-incident-log.md](05-incident-log.md) or click any number below.

1. [ZAP could not reach the preview server on Linux](06-incidents/01-zap-docker-networking.md)
2. [`serve` rejected `serve.json` because of `$schema`](06-incidents/02-zap-serve-schema.md)
3. [ZAP flagged nine missing security headers](06-incidents/03-zap-security-headers.md)
4. [`terraform fmt -check` failed on trailing whitespace](06-incidents/04-terraform-fmt.md)
5. [Checkov rejected `--soft-fail false`](06-incidents/05-checkov-soft-fail-arg.md)
6. [Checkov `CKV_AWS_259` demanded HSTS preload](06-incidents/06-checkov-ckv-aws-259.md)
7. [`aquasecurity/trivy-action@0.28.0` no longer resolves](06-incidents/07-trivy-action-tag.md)
8. [Trivy SARIF upload `Resource not accessible by integration`](06-incidents/08-trivy-sarif-permissions.md)
9. [SARIF upload failed with `Code scanning is not enabled`](06-incidents/09-trivy-sarif-default-setup.md)
10. [Trivy reported phantom CVEs from a stale `bun.lock`](06-incidents/10-trivy-findings-lockfile.md)
11. [Trivy `AVD-DS-0002`: container running as root](06-incidents/11-trivy-dockerfile-nonroot.md)
12. [Trivy IaC `AVD-AWS-0011` + `AVD-AWS-0132`](06-incidents/12-trivy-iac-waf-kms.md)
13. [Semgrep false positive on CloudFront TLS](06-incidents/13-semgrep-cloudfront-tls.md)
14. [CodeQL "default setup vs custom workflow" collision](06-incidents/14-codeql-default-vs-custom.md)
15. [Terraform OIDC rejected from PR context](06-incidents/15-terraform-oidc-pr-trust.md)
16. [`trufflesecurity/trufflehog@v3` does not resolve](06-incidents/16-trufflehog-action-tag.md)
17. [Terraform init failed on empty backend secrets](06-incidents/17-terraform-backend-secrets.md)
18. [`aws s3 sync` crashed with `NoSuchBucket`](06-incidents/18-deploy-missing-aws-targets.md)
19. [Deploy role had no S3 or CloudFront permissions (and policy placeholders)](06-incidents/19-deploy-iam-permissions-gap.md)

## How to reference this from a portfolio repo

If you maintain a separate portfolio repo and want to link to this case study:

- **Hero artefact**: the live CloudFront URL (see the output of `terraform output cloudfront_url` or [shot-list.md](shot-list.md) entry **S-01**).
- **Deepest dive**: [Incident 19](06-incidents/19-deploy-iam-permissions-gap.md) — full OIDC + IAM debugging thread with 403-vs-404 reasoning, stderr-capture foot-guns, and placeholder-substitution audit pattern.
- **Strongest narrative**: the [timeline at a glance](05-incident-log.md#timeline-at-a-glance) mermaid chart + the per-phase grouping in [05-incident-log.md](05-incident-log.md).
- **Three-bullet copy you can paste:**
  - *"Shipped a banking SPA to AWS (CloudFront + private S3, WAFv2, OIDC-only deploy role, least-privilege IAM inline policies) with six overlapping security scanners gating every merge."*
  - *"Documented 19 blocking DevSecOps incidents top-to-bottom — DAST header regressions, Trivy supply-chain tag yanks, IaC false positives, OIDC trust-policy scoping, and a multi-layer IAM debugging session — each with PR diff, failing-run log, and passing-run proof."*
  - *"Every scanner suppression carries a written rationale in-tree; no silent skips."*
- **Recommended link layout on your portfolio page:**
  1. Live URL (hero).
  2. This README (overview).
  3. [Incident log](05-incident-log.md) (headline evidence).
  4. [Architecture](02-architecture.md) (diagrams for a recruiter scan).

## Scope notes

- This case study is documentation-only. It does not modify workflows, Terraform, or application code.
- Dependabot PRs (#3-17 at time of writing) are acknowledged in [04-cicd-pipeline.md](04-cicd-pipeline.md) but not individually dissected — they are routine cadence, not incident material.
- Screenshot capture is a separate task tracked in [shot-list.md](shot-list.md); placeholders in `assets/` mark what remains.
